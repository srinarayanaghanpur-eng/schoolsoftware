import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  QueryConstraint
} from 'firebase/firestore';
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
    paymentType: 'annual_enrollment' | 'commitment' | 'other',
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
    const feeStatus = remainingAmount === 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending';

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

    const docRef = await addDoc(collection(db, 'payments'), paymentData);

    await updateDoc(studentRef, {
      totalFeesPaid: (student.totalFeesPaid || 0) + amountPaid,
      totalFeesDue: remainingAmount,
      feeStatus,
      lastPaymentDate: new Date().toISOString(),
      feeLastUpdated: serverTimestamp()
    });

    await this.generateReceipt(docRef.id, studentId, student, amountPaid, receiptNumber, userId);

    await this.logAuditEvent(
      'payment_recorded',
      docRef.id,
      studentId,
      { oldData: {}, newData: paymentData },
      userId
    );

    return docRef.id;
  },

  /**
   * Get all payments with optional filters
   */
  async getAllPayments(filters?: {
    studentId?: string;
    status?: string;
    dateRange?: { from: Date; to: Date };
  }): Promise<Payment[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    if (filters?.studentId) {
      constraints.unshift(where('studentId', '==', filters.studentId));
    }
    if (filters?.status) {
      constraints.unshift(where('status', '==', filters.status));
    }

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
      orderBy('paymentDate', 'desc')
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
    const payments = await this.getAllPayments();

    const totalCollected = payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + p.amountPaid, 0);

    return {
      totalPayments: payments.length,
      totalCollected,
      averagePayment: payments.length > 0 ? totalCollected / payments.length : 0,
      pendingPayments: payments.filter((p) => p.status === 'pending').length
    };
  },

  /**
   * Generate unique receipt number
   */
  async generateReceiptNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // Get count of receipts this month
    const startOfMonth = new Date(year, date.getMonth(), 1);
    const endOfMonth = new Date(year, date.getMonth() + 1, 0);

    const q = query(
      collection(db, 'receipts'),
      where(
        'receiptDate',
        '>=',
        startOfMonth.toISOString()
      ),
      where(
        'receiptDate',
        '<=',
        endOfMonth.toISOString()
      )
    );

    const snapshot = await getDocs(q);
    const count = String(snapshot.size + 1).padStart(4, '0');

    return `RCP-${year}-${month}-${count}`;
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
