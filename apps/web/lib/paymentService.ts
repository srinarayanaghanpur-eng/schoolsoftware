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
  setDoc,
  doc,
  serverTimestamp,
  writeBatch,
  QueryConstraint
} from 'firebase/firestore';
// `increment` is missing from the firebase/firestore wrapper's type defs (v10.14.1),
// so import it from the underlying package which declares it.
import { increment } from '@firebase/firestore';
import { db } from '@sri-narayana/shared/firebase/client';
import { Payment, Receipt } from '@/types/fee.types';

/**
 * Payment Service - Handles fee payments and receipts
 */

export const paymentService = {
  /**
   * Record a new payment
   */
  async recordPayment(
    studentId: string,
    amountPaid: number,
    paymentType: string,
    paymentMethod: 'cash' | 'cheque' | 'online' | 'transfer',
    concessionId: string | null,
    transactionId: string | null,
    remarks: string,
    userId: string
  ): Promise<string> {
    const studentRef = doc(db, 'students', studentId);
    const studentSnap = await getDoc(studentRef);

    if (!studentSnap.exists()) {
      throw new Error('Student not found');
    }

    const student = studentSnap.data();
    const amountDue = student.totalFeesDue || 0;
    const remainingAmount = Math.max(0, amountDue - amountPaid);
    const feeStatus = remainingAmount <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

    const receiptNumber = await this.generateReceiptNumber();

    const paymentData: Omit<Payment, 'id'> = {
      studentId,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      amountDue,
      amountPaid,
      remainingAmount,
      paymentType,
      concessionApplied: !!concessionId,
      concessionId: concessionId || undefined,
      paymentDate: new Date().toISOString(),
      paymentMethod,
      transactionId: transactionId || undefined,
      receiptNumber,
      remarks: remarks || undefined,
      recordedBy: userId,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Use batched write for atomicity across payment, student update, and receipt
    const batch = writeBatch(db);

    const paymentRef = doc(collection(db, 'payments'));
    batch.set(paymentRef, paymentData);

    batch.update(studentRef, {
      totalFeesPaid: increment(amountPaid),
      totalFeesDue: remainingAmount,
      feeStatus,
      lastPaymentDate: new Date().toISOString(),
      feeLastUpdated: serverTimestamp()
    });

    // Generate receipt
    const receiptData: Omit<Receipt, 'id'> = {
      receiptNumber,
      paymentId: paymentRef.id,
      studentId,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      class: student.class,
      section: student.section,
      amountPaid,
      paymentDate: new Date().toISOString(),
      receiptDate: new Date().toISOString(),
      issuedBy: userId,
      status: 'issued',
      createdAt: new Date().toISOString()
    };
    const receiptRef = doc(collection(db, 'receipts'));
    batch.set(receiptRef, receiptData);



    // Log audit
    const auditRef = doc(collection(db, 'feeAuditLogs'));
    batch.set(auditRef, {
      action: 'payment_recorded',
      entityType: 'payment',
      entityId: paymentRef.id,
      studentId,
      changes: { oldData: {}, newData: paymentData },
      userId,
      timestamp: serverTimestamp()
    });

    await batch.commit();
    return paymentRef.id;
  },

  /**
   * Get all payments with optional filters
   */
  async getAllPayments(filters?: {
    studentId?: string;
    status?: string;
    dateRange?: { from: Date; to: Date };
  }): Promise<Payment[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.studentId) {
      constraints.push(where('studentId', '==', filters.studentId));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }

    // Only add orderBy when filters are present (avoids full collection scan)
    if (filters?.studentId || filters?.status) {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    // Always limit results to prevent unbounded reads
    constraints.push(limit(100));

    const q = query(collection(db, 'payments'), ...constraints);
    const snapshot = await getDocs(q);
    let payments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Payment[];

    // Filter by date range if provided
    if (filters?.dateRange) {
      const fromTime = filters.dateRange.from.getTime();
      const toTime = filters.dateRange.to.getTime();

      payments = payments.filter((payment) => {
        const paymentTime = new Date(payment.paymentDate).getTime();
        return paymentTime >= fromTime && paymentTime <= toTime;
      });
    }

    return payments;
  },

  /**
   * Get payments for a specific student
   */
  async getStudentPayments(studentId: string): Promise<Payment[]> {
    const q = query(
      collection(db, 'payments'),
      where('studentId', '==', studentId),
      orderBy('paymentDate', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Payment[];
  },

  /**
   * Get single payment
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    const docSnap = await getDoc(doc(db, 'payments', paymentId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Payment;
  },

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{
    totalPayments: number;
    totalCollected: number;
    averagePayment: number;
    pendingPayments: number;
  }> {
    // Use targeted queries with limits instead of unbounded getAllPayments
    const completedQuery = query(
      collection(db, 'payments'),
      where('status', '==', 'completed'),
      limit(1000)
    );
    const completedSnap = await getDocs(completedQuery);
    const completedPayments = completedSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Payment[];

    const pendingQuery = query(
      collection(db, 'payments'),
      where('status', '==', 'pending'),
      limit(1000)
    );
    const pendingSnap = await getDocs(pendingQuery);
    const pendingPayments = pendingSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Payment[];

    const allPayments = [...completedPayments, ...pendingPayments];
    const totalCollected = completedPayments.reduce((sum, p) => sum + p.amountPaid, 0);

    return {
      totalPayments: allPayments.length,
      totalCollected,
      averagePayment: allPayments.length > 0 ? totalCollected / allPayments.length : 0,
      pendingPayments: pendingPayments.length
    };
  },

  /**
   * Generate unique receipt number
   */
  async generateReceiptNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const counterId = `receipt_counter_${year}_${month}`;

    // Use a counter document with Firestore transaction for atomic increment
    const counterRef = doc(db, 'counters', counterId);
    const counterSnap = await getDoc(counterRef);

    let count: number;
    if (!counterSnap.exists()) {
      await setDoc(counterRef, { count: 1, createdAt: serverTimestamp() });
      count = 1;
    } else {
      const current = (counterSnap.data().count || 0) + 1;
      await updateDoc(counterRef, { count: current });
      count = current;
    }

    return `RCP-${year}-${month}-${String(count).padStart(4, '0')}`;
  },

  /**
   * Generate receipt document
   */
  async generateReceipt(
    paymentId: string,
    studentId: string,
    studentData: any,
    amountPaid: number,
    receiptNumber: string,
    userId: string
  ): Promise<string> {
    const receiptData: Omit<Receipt, 'id'> = {
      receiptNumber,
      paymentId,
      studentId,
      admissionNumber: studentData.admissionNumber,
      studentName: studentData.studentName,
      class: studentData.class,
      section: studentData.section,
      amountPaid,
      paymentDate: new Date().toISOString(),
      receiptDate: new Date().toISOString(),
      issuedBy: userId,
      status: 'issued',
      createdAt: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'receipts'), receiptData);

    // Update payment with receipt reference
    await updateDoc(doc(db, 'payments', paymentId), {
      receiptNumber: receiptNumber
    });

    return docRef.id;
  },

  /**
   * Get receipts for a student
   */
  async getStudentReceipts(studentId: string): Promise<Receipt[]> {
    const q = query(
      collection(db, 'receipts'),
      where('studentId', '==', studentId),
      orderBy('receiptDate', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Receipt[];
  },

  /**
   * Get single receipt
   */
  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    const docSnap = await getDoc(doc(db, 'receipts', receiptId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Receipt;
  },

  /**
   * Update receipt status
   */
  async updateReceiptStatus(
    receiptId: string,
    status: 'draft' | 'issued' | 'cancelled',
    userId: string
  ): Promise<void> {
    const receiptRef = doc(db, 'receipts', receiptId);
    const receiptSnap = await getDoc(receiptRef);

    if (!receiptSnap.exists()) {
      throw new Error('Receipt not found');
    }

    const receipt = receiptSnap.data() as Receipt;

    await updateDoc(receiptRef, { status });

    // Log audit
    await this.logAuditEvent(
      'receipt_status_updated',
      receiptId,
      receipt.studentId,
      { oldData: { status: receipt.status }, newData: { status } },
      userId
    );
  },

  /**
   * Log audit event
   */
  async logAuditEvent(
    action: string,
    entityId: string,
    studentId: string,
    changes: { oldData: any; newData: any },
    userId: string
  ): Promise<void> {
    try {
      await addDoc(collection(db, 'feeAuditLogs'), {
        action,
        entityType: 'payment',
        entityId,
        studentId,
        changes,
        userId,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
    }
  }
};

export default paymentService;
