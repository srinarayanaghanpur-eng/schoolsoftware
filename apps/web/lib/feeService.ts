import {
  collection,
  query,
  where,
  orderBy,
  limit,
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
    const snapshot = await getDocs(query(collection(db, 'fee_structures'), limit(200)));
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
      collection(db, 'fee_structures'),
      where('classRange', '==', classRange),
      limit(1)
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
    const docRef = await addDoc(collection(db, 'fee_structures'), {
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
    await updateDoc(doc(db, 'fee_structures', id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
  },

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    // NOTE: prefer the server endpoint /api/admin/reports/dashboard-stats,
    // which uses aggregate queries (1 read per 1000 docs). This client-side
    // fallback is bounded to avoid reading the entire collection.
    const studentsSnapshot = await getDocs(query(collection(db, 'students'), limit(1000)));
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
        where('isActive', '==', true),
        limit(500)
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
        where('status', '==', 'pending'),
        limit(500)
      )
    );
    const pendingApprovals = pendingSnapshot.size;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Filter by date at Firestore level instead of downloading every payment.
    const paymentsSnapshot = await getDocs(
      query(
        collection(db, 'payments'),
        where('createdAt', '>=', monthStart),
        where('createdAt', '<=', monthEnd),
        limit(2000)
      )
    );
    const monthlyPayments = paymentsSnapshot.docs.map((d: any) => d.data());

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
    const raw = student as Record<string, unknown>;
    const annualEnrollmentFee = Math.max(0, Number(raw.annualEnrollmentFee) || 0);
    const commitmentFee = Math.max(0, Number(raw.committedPayableFee || raw.commitmentFee) || 0);
    const totalFeeAmount = Math.max(0, Number(raw.totalFeeAmount) || commitmentFee);
    const rawDue = raw.totalFeesDue;
    const totalFeeDue = rawDue != null ? Math.max(0, Number(rawDue)) : totalFeeAmount;
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
        where('status', '==', 'completed'),
        limit(200)
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
    const commitmentFee = student?.committedPayableFee || student?.commitmentFee || 0;
    const totalFeeAmount = student?.totalFeeAmount || commitmentFee;
    const totalFeeDue = Math.max(0, totalFeeAmount - totalFeePaid);
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
  async getFeeDueStudents(threshold: number = 0, max: number = 200): Promise<any[]> {
    const studentsSnapshot = await getDocs(
      query(
        collection(db, 'students'),
        where('totalFeesDue', '>', threshold),
        orderBy('totalFeesDue', 'desc'),
        limit(max)
      )
    );
    return studentsSnapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((s: Record<string, unknown>) => {
        const status = String(s.feeStatus || "");
        const due = Number(s.totalFeesDue ?? 0);
        return status !== "paid" && due > 0;
      });
  },

  /**
   * Get fully paid students
   */
  async getFullyPaidStudents(max: number = 500): Promise<any[]> {
    // Equality filter at Firestore level instead of full-collection scan.
    const studentsSnapshot = await getDocs(
      query(collection(db, 'students'), where('totalFeesDue', '==', 0), limit(max))
    );
    return studentsSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
};

export default feeService;
