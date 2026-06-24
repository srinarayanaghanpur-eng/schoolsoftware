import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '@sri-narayana/shared/firebase/client';
import { Payment } from '@/types/fee.types';

/**
 * Report Service - Generate various fee reports
 */

export const reportService = {
  /**
   * Generate Class-Wise Fee Report
   */
  async generateClassWiseFeeReport(filters?: {
    class?: string;
    dateRange?: { from: Date; to: Date };
  }): Promise<any[]> {
    let queryRef: any = collection(db, 'students');
    if (filters?.class) {
      queryRef = query(collection(db, 'students'), where('class', '==', filters.class));
    }

    const studentsSnapshot = await getDocs(queryRef);
    const students = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const byClass: Record<string, any> = {};

    students.forEach((student) => {
      const key = student.class;
      if (!byClass[key]) {
        byClass[key] = {
          class: student.class,
          totalStudents: 0,
          totalFeeAmount: 0,
          totalFeeDue: 0,
          totalFeePaid: 0,
          totalFeeOutstanding: 0,
          students: []
        };
      }

      byClass[key].totalStudents++;
      byClass[key].totalFeeAmount += student.totalFeeAmount || 0;
      byClass[key].totalFeeDue += student.totalFeesDue || 0;
      byClass[key].totalFeePaid += student.totalFeesPaid || 0;
      byClass[key].totalFeeOutstanding += Math.max(0, (student.totalFeesDue || 0) - (student.totalFeesPaid || 0));
      byClass[key].students.push(student);
    });

    const result = Object.values(byClass).map((classData) => ({
      ...classData,
      averageAnnualFee:
        classData.totalStudents > 0
          ? classData.totalFeeAmount / classData.totalStudents
          : 0,
      feePaidPercentage:
        classData.totalFeeDue > 0
          ? ((classData.totalFeePaid / classData.totalFeeDue) * 100).toFixed(2)
          : '0.00'
    }));

    return result.sort((a, b) => a.class.localeCompare(b.class));
  },

  /**
   * Generate Student-Wise Fee Report
   */
  async generateStudentWiseFeeReport(filters?: {
    class?: string;
  }): Promise<any[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.class) {
      constraints.push(where('class', '==', filters.class));
    }

    constraints.push(orderBy('studentName'));

    const q = query(collection(db, 'students'), ...constraints);
    const snapshot = await getDocs(q);
    const students = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const paymentsSnapshot = await getDocs(collection(db, 'payments'));
    const paymentsByStudent: Record<string, Payment[]> = {};

    paymentsSnapshot.forEach((doc) => {
      const payment = doc.data() as Payment;
      if (!paymentsByStudent[payment.studentId]) {
        paymentsByStudent[payment.studentId] = [];
      }
      paymentsByStudent[payment.studentId].push(payment);
    });

    return students.map((student) => {
      const payments = paymentsByStudent[student.id] || [];
      const totalPaid = payments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amountPaid, 0);
      const remaining = (student.totalFeesDue || 0) - totalPaid;

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        annualEnrollmentFee: student.annualEnrollmentFee || 0,
        commitmentFee: student.commitmentFee || 0,
        totalFeeAmount: student.totalFeeAmount || 0,
        totalFeeDue: student.totalFeesDue || 0,
        totalPaid,
        remainingAmount: remaining,
        feeStatus: student.feeStatus || 'pending',
        lastPaymentDate: student.lastPaymentDate || null
      };
    });
  },

  /**
   * Generate Attendance vs Fee Report
   */
  async generateAttendanceFeeReport(filters?: {
    class?: string;
    minAttendance?: number;
    maxAttendance?: number;
  }): Promise<any[]> {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    let students = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    if (filters?.class) {
      students = students.filter((s) => s.class === filters.class);
    }

    const paymentsSnapshot = await getDocs(collection(db, 'payments'));
    const paymentsByStudent: Record<string, Payment[]> = {};

    paymentsSnapshot.forEach((doc) => {
      const payment = doc.data() as Payment;
      if (!paymentsByStudent[payment.studentId]) {
        paymentsByStudent[payment.studentId] = [];
      }
      paymentsByStudent[payment.studentId].push(payment);
    });

    let report = students.map((student) => {
      const payments = paymentsByStudent[student.id] || [];
      const totalPaid = payments
        .filter((p) => p.status === 'completed')
        .reduce((sum, p) => sum + p.amountPaid, 0);
      const attendance = student.attendancePercentage || 0;
      const feeDue = student.totalFeesDue || 0;

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        attendancePercentage: attendance,
        annualEnrollmentFee: student.annualEnrollmentFee || 0,
        commitmentFee: student.commitmentFee || 0,
        totalFeeAmount: student.totalFeeAmount || 0,
        totalFeeDue: feeDue,
        totalPaid,
        feePaidPercentage: feeDue > 0 ? ((totalPaid / feeDue) * 100).toFixed(2) : '0.00',
        commitmentStatus: student.feeStatus || 'pending',
        attendanceEligibility: attendance >= 75 ? 'Eligible' : 'Ineligible'
      };
    });

    // Filter by attendance range if provided
    if (filters?.minAttendance || filters?.maxAttendance) {
      const min = filters?.minAttendance || 0;
      const max = filters?.maxAttendance || 100;

      report = report.filter(
        (r) => r.attendancePercentage >= min && r.attendancePercentage <= max
      );
    }

    return report.sort((a, b) => b.attendancePercentage - a.attendancePercentage);
  },

  /**
   * Generate Monthly Collection Report
   */
  async generateMonthlyCollectionReport(month: number, year: number): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const q = query(
      collection(db, 'payments'),
      where('status', '==', 'completed')
    );

    const snapshot = await getDocs(q);
    let payments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Payment[];

    // Filter by date range
    payments = payments.filter((p) => {
      const paymentDate = new Date(p.paymentDate);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const totalCollected = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalTransactions = payments.length;
    const averageTransaction =
      totalTransactions > 0 ? totalCollected / totalTransactions : 0;

    // Group by payment method
    const byMethod: Record<string, { count: number; amount: number }> = {};
    payments.forEach((payment) => {
      if (!byMethod[payment.paymentMethod]) {
        byMethod[payment.paymentMethod] = { count: 0, amount: 0 };
      }
      byMethod[payment.paymentMethod].count++;
      byMethod[payment.paymentMethod].amount += payment.amountPaid;
    });

    return {
      month,
      year,
      totalCollected,
      totalTransactions,
      averageTransaction,
      byMethod,
      topStudents: payments
        .sort((a, b) => b.amountPaid - a.amountPaid)
        .slice(0, 10)
    };
  },

  /**
   * Generate Class-Wise Fee Status Report
   */
  async generateClassWiseFeeStatusReport(): Promise<any[]> {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const students = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const byClass: Record<string, any> = {};

    students.forEach((student) => {
      const key = student.class;

      if (!byClass[key]) {
        byClass[key] = {
          class: student.class,
          totalStudents: 0,
          totalFeeDue: 0,
          totalFeePaid: 0,
          totalFeeOutstanding: 0,
          feePaidPercentage: 0,
          students: []
        };
      }

      byClass[key].totalStudents++;
      byClass[key].totalFeeDue += student.totalFeesDue || 0;
      byClass[key].totalFeePaid += student.totalFeesPaid || 0;
      byClass[key].totalFeeOutstanding +=
        (student.totalFeesDue || 0) - (student.totalFeesPaid || 0);
      byClass[key].students.push(student);
    });

    // Calculate percentages
    return Object.values(byClass).map((classData) => ({
      ...classData,
      feePaidPercentage:
        classData.totalFeeDue > 0
          ? ((classData.totalFeePaid / classData.totalFeeDue) * 100).toFixed(2)
          : '0.00'
    }));
  }
};

export default reportService;
