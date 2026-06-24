import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@sri-narayana/shared/firebase/client';
import { FeeStructure, DashboardStats } from '@/types/fee.types';

/**
 * General Fee Service - Handle fee structures and overall fee management
 */

export const feeService = {
  /**
   * Get all fee structures
   */
  async getAllFeeStructures(): Promise<FeeStructure[]> {
    const snapshot = await getDocs(collection(db, 'feeStructures'));
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as FeeStructure[];
  },

  /**
   * Get fee structure by class range
   */
  async getFeeStructureByClass(classRange: string): Promise<FeeStructure | null> {
    const q = query(
      collection(db, 'feeStructures'),
      where('classRange', '==', classRange)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as FeeStructure;
  },

  /**
   * Create new fee structure
   */
  async createFeeStructure(data: Omit<FeeStructure, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'feeStructures'), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  },

  /**
   * Update fee structure
   */
  async updateFeeStructure(
    id: string,
    updates: Partial<Omit<FeeStructure, 'id' | 'createdAt'>>
  ): Promise<void> {
    await updateDoc(doc(db, 'feeStructures', id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const students = studentsSnapshot.docs.map((d: any) => d.data());
    const totalStudents = students.length;

    const totalFeeAmount = students.reduce(
      (sum: any, s: any) => sum + (s.totalFeeAmount || 0),
      0
    );
    const totalFeeDue = students.reduce((sum: any, s: any) => sum + (s.totalFeesDue || 0), 0);
    const totalFeeCollected = students.reduce(
      (sum: any, s: any) => sum + (s.totalFeesPaid || 0),
      0
    );
    const totalFeeOutstanding = students.reduce(
      (sum: any, s: any) => sum + Math.max(0, (s.totalFeesDue || 0) - (s.totalFeesPaid || 0)),
      0
    );
    const studentsWithOutstandingFees = students.filter(
      (s: any) => Math.max(0, (s.totalFeesDue || 0) - (s.totalFeesPaid || 0)) > 0
    ).length;

    const averageAnnualFee = totalStudents > 0 ? totalFeeAmount / totalStudents : 0;

    // Keep concession metrics for backward compatibility
    const concessionsSnapshot = await getDocs(
      query(
        collection(db, 'concessions'),
        where('status', '==', 'approved'),
        where('isActive', '==', true)
      )
    );
    const concessions = concessionsSnapshot.docs.map((d: any) => d.data());
    const studentsWithConcession = new Set(
      concessions.map((c: any) => c.studentId)
    ).size;
    const totalConcessionAmount = concessions.reduce(
      (sum: any, c: any) => sum + (c.concessionAmount || 0),
      0
    );

    const pendingSnapshot = await getDocs(
      query(
        collection(db, 'concessions'),
        where('status', '==', 'pending')
      )
    );
    const pendingApprovals = pendingSnapshot.size;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const paymentsSnapshot = await getDocs(collection(db, 'payments'));
    const monthlyPayments = paymentsSnapshot.docs
      .map((d: any) => d.data())
      .filter((p: any) => {
        const paymentDate = new Date(p.paymentDate);
        return paymentDate >= monthStart && paymentDate <= monthEnd;
      });

    const monthlyCollection = monthlyPayments.reduce(
      (sum, p: any) => sum + p.amountPaid,
      0
    );

    return {
      totalStudents,
      studentsWithConcession,
      totalConcessionAmount,
      totalFeeAmount,
      totalFeeDue,
      totalFeeCollected,
      totalFeeOutstanding,
      studentsWithOutstandingFees,
      averageAnnualFee,
      pendingApprovals,
      monthlyCollection,
      averageConcession: studentsWithConcession > 0 ? totalConcessionAmount / studentsWithConcession : 0
    };
  },

  /**
   * Get fee summary for a student
   */
  async getStudentFeeSummary(
    studentId: string
  ): Promise<{
    admissionNumber: string;
    studentName: string;
    class: string;
    annualEnrollmentFee: number;
    commitmentFee: number;
    totalFeeAmount: number;
    totalFeeDue: number;
    totalFeePaid: number;
    remainingAmount: number;
    feePaidPercentage: number;
    feeStatus: string;
    lastPaymentDate: string | null;
  } | null> {
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) return null;

    const student = studentSnap.data();
    const annualEnrollmentFee = (student as any)?.annualEnrollmentFee || 0;
    const commitmentFee = (student as any)?.commitmentFee || 0;
    const totalFeeAmount = (student as any)?.totalFeeAmount || annualEnrollmentFee + commitmentFee;
    const totalFeeDue = (student as any)?.totalFeesDue || totalFeeAmount;
    const totalFeePaid = (student as any)?.totalFeesPaid || 0;
    const remainingAmount = totalFeeDue - totalFeePaid;
    const feePaidPercentage = totalFeeDue > 0 ? (totalFeePaid / totalFeeDue) * 100 : 0;

    return {
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      class: student.class,
      annualEnrollmentFee,
      commitmentFee,
      totalFeeAmount,
      totalFeeDue,
      totalFeePaid,
      remainingAmount,
      feePaidPercentage: Math.round(feePaidPercentage),
      feeStatus: student.feeStatus || (remainingAmount === 0 ? 'paid' : totalFeePaid > 0 ? 'partial' : 'pending'),
      lastPaymentDate: student.lastPaymentDate || null
    };
  },

  /**
   * Update student attendance percentage
   */
  async updateStudentAttendance(
    studentId: string,
    attendancePercentage: number
  ): Promise<void> {
    await updateDoc(doc(db, 'students', studentId), {
      attendancePercentage,
      feeLastUpdated: serverTimestamp()
    });
  },

  /**
   * Batch update student fee data from payments
   */
  async syncStudentFeeData(studentId: string): Promise<void> {
    const paymentsSnapshot = await getDocs(
      query(
        collection(db, 'payments'),
        where('studentId', '==', studentId),
        where('status', '==', 'completed')
      )
    );

    const payments = paymentsSnapshot.docs.map((d) => d.data());
    const totalFeePaid = payments.reduce((sum, p: any) => sum + p.amountPaid, 0);

    const lastPayment = payments.sort(
      (a: any, b: any) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    )[0];

    const studentSnap = await getDoc(doc(db, 'students', studentId));
    const student = studentSnap.data();
    const annualEnrollmentFee = student?.annualEnrollmentFee || 0;
    const commitmentFee = student?.commitmentFee || 0;
    const totalFeeAmount = student?.totalFeeAmount || annualEnrollmentFee + commitmentFee;
    const totalFeeDue = totalFeeAmount - totalFeePaid;
    const feeStatus = totalFeeDue === 0 ? 'paid' : totalFeePaid > 0 ? 'partial' : 'pending';

    await updateDoc(doc(db, 'students', studentId), {
      totalFeesPaid: totalFeePaid,
      totalFeeDue,
      feeStatus,
      lastPaymentDate: lastPayment?.paymentDate || null,
      feeLastUpdated: serverTimestamp()
    });
  },

  /**
   * Get fee due students (for follow-up)
   */
  async getFeeDueStudents(threshold: number = 0): Promise<any[]> {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const students = studentsSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    return students
      .filter((s) => (s.totalFeesDue || 0) > threshold)
      .sort((a, b) => (b.totalFeesDue || 0) - (a.totalFeesDue || 0));
  },

  /**
   * Get fully paid students
   */
  async getFullyPaidStudents(): Promise<any[]> {
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    const students = studentsSnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

    return students.filter((s) => (s.totalFeesDue || 0) === 0);
  }
};

export default feeService;
