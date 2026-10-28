import { adminDb } from '@/lib/firebaseAdmin';
import { logFirestoreRead } from "@/lib/firestoreReadLogger";
import { resolveFeeState } from "@/lib/feeModel";
import { Payment } from '@/types/fee.types';

const DEFAULT_REPORT_LIMIT = 500;
const DEFAULT_PAYMENT_REPORT_LIMIT = 1000;

export const reportService = {
  async generateClassWiseFeeReport(filters?: {
    class?: string;
    dateRange?: { from: Date; to: Date };
  }): Promise<any[]> {
    const db = adminDb();
    let queryRef: FirebaseFirestore.Query = db.collection('students');
    if (filters?.class) {
      queryRef = queryRef.where('class', '==', filters.class);
    }

    queryRef = queryRef.limit(DEFAULT_REPORT_LIMIT);
    const studentsSnapshot = await queryRef.get();
    logFirestoreRead("LegacyReportService", "students", studentsSnapshot, { report: "class-wise", limit: DEFAULT_REPORT_LIMIT });
    const students = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const byClass: Record<string, any> = {};

    students.forEach((student: any) => {
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

      const fee = resolveFeeState(student);
      byClass[key].totalStudents++;
      byClass[key].totalFeeAmount += fee.payableFee;
      byClass[key].totalFeeDue += fee.due;
      byClass[key].totalFeePaid += fee.paid;
      byClass[key].totalFeeOutstanding += fee.due;
      byClass[key].students.push(student);
    });

    return Object.values(byClass).map((classData: any) => ({
      ...classData,
      averageAnnualFee:
        classData.totalStudents > 0
          ? classData.totalFeeAmount / classData.totalStudents
          : 0,
      feePaidPercentage:
        classData.totalFeeAmount > 0
          ? ((classData.totalFeePaid / classData.totalFeeAmount) * 100).toFixed(2)
          : '0.00'
    })).sort((a: any, b: any) => a.class.localeCompare(b.class));
  },

  async generateStudentWiseFeeReport(filters?: {
    class?: string;
  }): Promise<any[]> {
    const db = adminDb();
    let queryRef: FirebaseFirestore.Query = db.collection('students');

    if (filters?.class) {
      queryRef = queryRef.where('class', '==', filters.class);
    }

    queryRef = queryRef.orderBy('studentName').limit(DEFAULT_REPORT_LIMIT);

    const snapshot = await queryRef.get();
    logFirestoreRead("LegacyReportService", "students", snapshot, { report: "student-wise", limit: DEFAULT_REPORT_LIMIT });
    const students = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    return students.map((student: any) => {
      const fee = resolveFeeState(student);

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        annualEnrollmentFee: fee.originalFee,
        commitmentFee: fee.payableFee,
        totalFeeAmount: fee.payableFee,
        totalFeeDue: fee.due,
        totalPaid: fee.paid,
        remainingAmount: fee.due,
        feeStatus: fee.status,
        lastPaymentDate: student.lastPaymentDate || null
      };
    });
  },

  async generateAttendanceFeeReport(filters?: {
    class?: string;
    minAttendance?: number;
    maxAttendance?: number;
  }): Promise<any[]> {
    const db = adminDb();
    let studentsQuery: FirebaseFirestore.Query = db.collection('students');
    if (filters?.class) {
      studentsQuery = studentsQuery.where('class', '==', filters.class);
    }
    studentsQuery = studentsQuery.limit(DEFAULT_REPORT_LIMIT);
    const studentsSnapshot = await studentsQuery.get();
    logFirestoreRead("LegacyReportService", "students", studentsSnapshot, { report: "attendance-fee", class: filters?.class || "", limit: DEFAULT_REPORT_LIMIT });
    let students = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    let report = students.map((student: any) => {
      const fee = resolveFeeState(student);
      const attendance = student.attendancePercentage || 0;

      return {
        admissionNumber: student.admissionNumber,
        studentName: student.studentName,
        class: student.class,
        section: student.section,
        attendancePercentage: attendance,
        annualEnrollmentFee: fee.originalFee,
        commitmentFee: fee.payableFee,
        totalFeeAmount: fee.payableFee,
        totalFeeDue: fee.due,
        totalPaid: fee.paid,
        feePaidPercentage:
          fee.payableFee > 0 ? ((fee.paid / fee.payableFee) * 100).toFixed(2) : '0.00',
        commitmentStatus: fee.status,
        attendanceEligibility: attendance >= 75 ? 'Eligible' : 'Ineligible'
      };
    });

    if (filters?.minAttendance || filters?.maxAttendance) {
      const min = filters?.minAttendance || 0;
      const max = filters?.maxAttendance || 100;

      report = report.filter(
        (r: any) => r.attendancePercentage >= min && r.attendancePercentage <= max
      );
    }

    return report.sort((a: any, b: any) => b.attendancePercentage - a.attendancePercentage);
  },

  async generateMonthlyCollectionReport(month: number, year: number): Promise<any> {
    const db = adminDb();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const snapshot = await db.collection('payments')
      .where('status', '==', 'completed')
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .orderBy("createdAt", "desc")
      .limit(DEFAULT_PAYMENT_REPORT_LIMIT)
      .get();
    logFirestoreRead("LegacyReportService", "payments", snapshot, { report: "monthly-collection", month, year, limit: DEFAULT_PAYMENT_REPORT_LIMIT });
    let payments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Payment[];

    payments = payments.filter((p) => {
      const paymentDate = new Date(p.paymentDate);
      return paymentDate >= startDate && paymentDate <= endDate;
    });

    const totalCollected = payments.reduce((sum, p) => sum + p.amountPaid, 0);
    const totalTransactions = payments.length;
    const averageTransaction =
      totalTransactions > 0 ? totalCollected / totalTransactions : 0;

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

  async generateClassWiseFeeStatusReport(): Promise<any[]> {
    const db = adminDb();
    const studentsSnapshot = await db.collection('students').limit(DEFAULT_REPORT_LIMIT).get();
    logFirestoreRead("LegacyReportService", "students", studentsSnapshot, { report: "class-fee-status", limit: DEFAULT_REPORT_LIMIT });
    const students = studentsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    const byClass: Record<string, any> = {};

    students.forEach((student: any) => {
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

      const fee = resolveFeeState(student);
      byClass[key].totalStudents++;
      byClass[key].totalFeeDue += fee.due;
      byClass[key].totalFeePaid += fee.paid;
      byClass[key].totalFeeOutstanding += fee.due;
      byClass[key].students.push(student);
    });

    return Object.values(byClass).map((classData: any) => {
      const totalPayable = classData.totalFeeDue + classData.totalFeePaid;
      return {
        ...classData,
        feePaidPercentage:
          totalPayable > 0
            ? ((classData.totalFeePaid / totalPayable) * 100).toFixed(2)
            : '0.00'
      };
    });
  }
};

export default reportService;
