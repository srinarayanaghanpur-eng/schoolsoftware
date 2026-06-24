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
  Timestamp,
  writeBatch,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '@sri-narayana/shared/firebase/client';
import {
  Concession,
  CreateConcessionPayload,
  UpdateConcessionPayload,
  Student
} from '@/types/fee.types';

/**
 * Concession Service - Handles all concession-related operations
 */

export const concessionService = {
  /**
   * Get all concessions with optional filtering
   */
  async getAllConcessions(filters?: {
    status?: string;
    class?: string;
    studentId?: string;
  }): Promise<Concession[]> {
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];

    if (filters?.status) {
      constraints.unshift(where('status', '==', filters.status));
    }
    if (filters?.class) {
      constraints.unshift(where('class', '==', filters.class));
    }
    if (filters?.studentId) {
      constraints.unshift(where('studentId', '==', filters.studentId));
    }

    const q = query(collection(db, 'concessions'), ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Concession[];
  },

  /**
   * Get concessions for a specific student
   */
  async getStudentConcessions(studentId: string): Promise<Concession[]> {
    const q = query(
      collection(db, 'concessions'),
      where('studentId', '==', studentId),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Concession[];
  },

  /**
   * Get active concessions for a student
   */
  async getActiveConcessions(studentId: string): Promise<Concession[]> {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'concessions'),
      where('studentId', '==', studentId),
      where('isActive', '==', true),
      where('validFrom', '<=', now),
      where('validUpto', '>=', now),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    })) as Concession[];
  },

  /**
   * Get single concession by ID
   */
  async getConcessionById(concessionId: string): Promise<Concession | null> {
    const docSnap = await getDoc(doc(db, 'concessions', concessionId)) as any;
    if (!docSnap.exists()) return null;
    return { id: (docSnap as any).id, ...(docSnap as any).data() } as Concession;
  },

  /**
   * Create new concession
   */
  async createConcession(
    payload: CreateConcessionPayload,
    userId: string
  ): Promise<string> {
    const concessionData = {
      ...payload,
      status: 'pending',
      isActive: false,
      history: [
        {
          action: 'created',
          changedBy: userId,
          changedAt: serverTimestamp(),
          oldData: {},
          newData: payload
        }
      ],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'concessions'), concessionData);

    // Log to audit
    await this.logAuditEvent('concession_created', docRef.id, payload.studentId, {
      oldData: {},
      newData: concessionData
    }, userId);

    return docRef.id;
  },

  /**
   * Update concession status (approve/reject)
   */
  async updateConcessionStatus(
    concessionId: string,
    status: 'approved' | 'rejected',
    approvalNotes: string,
    userId: string
  ): Promise<void> {
    const concessionRef = doc(db, 'concessions', concessionId);
    const concessionSnap = await getDoc(concessionRef);

    if (!concessionSnap.exists()) {
      throw new Error('Concession not found');
    }

    const oldData = (concessionSnap as any).data() as any;

    const updateData = {
      status,
      approvalNotes,
      approvedBy: userId,
      approvalDate: serverTimestamp(),
      isActive: status === 'approved',
      updatedAt: serverTimestamp(),
      history: [
        ...(oldData.history || []),
        {
          action: status === 'approved' ? 'approved' : 'rejected',
          changedBy: userId,
          changedAt: serverTimestamp(),
          oldData: { status: oldData.status },
          newData: { status }
        }
      ]
    };

    await updateDoc(concessionRef, updateData);

    // Update student's concession count
    if (status === 'approved') {
      await this.updateStudentConcessionStatus(oldData.studentId);
    }

    // Log to audit
    await this.logAuditEvent('concession_updated', concessionId, oldData.studentId, {
      oldData: { status: oldData.status },
      newData: { status }
    }, userId);
  },

  /**
   * Edit concession details (only pending concessions)
   */
  async editConcession(
    concessionId: string,
    updates: UpdateConcessionPayload,
    userId: string
  ): Promise<void> {
    const concessionRef = doc(db, 'concessions', concessionId);
    const concessionSnap = await getDoc(concessionRef);

    if (!concessionSnap.exists()) {
      throw new Error('Concession not found');
    }

    const concession = concessionSnap.data() as Concession;

    if (concession.status !== 'pending') {
      throw new Error('Cannot edit approved or rejected concessions');
    }

    const updateData = {
      ...updates,
      updatedAt: serverTimestamp(),
      history: [
        ...(concession.history || []),
        {
          action: 'edited',
          changedBy: userId,
          changedAt: serverTimestamp(),
          oldData: {
            concessionAmount: concession.concessionAmount,
            concessionPercent: concession.concessionPercent,
            validUpto: concession.validUpto
          },
          newData: updates
        }
      ]
    };

    await updateDoc(concessionRef, updateData);

    // Log to audit
    await this.logAuditEvent('concession_edited', concessionId, concession.studentId, {
      oldData: {
        concessionAmount: concession.concessionAmount,
        concessionPercent: concession.concessionPercent
      },
      newData: {
        concessionAmount: updates.concessionAmount,
        concessionPercent: updates.concessionPercent
      }
    }, userId);
  },

  /**
   * Delete concession (only pending)
   */
  async deleteConcession(concessionId: string, userId: string): Promise<void> {
    const concessionRef = doc(db, 'concessions', concessionId);
    const concessionSnap = await getDoc(concessionRef);

    if (!concessionSnap.exists()) {
      throw new Error('Concession not found');
    }

    const concession = concessionSnap.data() as Concession;

    if (concession.status !== 'pending') {
      throw new Error('Cannot delete approved or rejected concessions');
    }

    await updateDoc(concessionRef, {
      isActive: false,
      status: 'rejected', // Mark as rejected instead of deleting
      updatedAt: serverTimestamp(),
      history: [
        ...(concession.history || []),
        {
          action: 'deleted',
          changedBy: userId,
          changedAt: serverTimestamp(),
          oldData: { status: concession.status },
          newData: { status: 'rejected' }
        }
      ]
    });

    // Log to audit
    await this.logAuditEvent('concession_deleted', concessionId, concession.studentId, {
      oldData: concession,
      newData: {}
    }, userId);
  },

  /**
   * Get concession statistics
   */
  async getConcessionStats(): Promise<{
    totalConcessions: number;
    pendingApprovals: number;
    approvedConcessions: number;
    rejectedConcessions: number;
    activeConcessions: number;
    totalAmount: number;
  }> {
    const concessions = await this.getAllConcessions();

    return {
      totalConcessions: concessions.length,
      pendingApprovals: concessions.filter((c) => c.status === 'pending').length,
      approvedConcessions: concessions.filter((c) => c.status === 'approved').length,
      rejectedConcessions: concessions.filter((c) => c.status === 'rejected').length,
      activeConcessions: concessions.filter((c) => c.isActive && c.status === 'approved').length,
      totalAmount: concessions
        .filter((c) => c.status === 'approved')
        .reduce((sum, c) => sum + (c.concessionAmount || 0), 0)
    };
  },

  /**
   * Update student's concession summary
   */
  async updateStudentConcessionStatus(studentId: string): Promise<void> {
    const studentRef = doc(db, 'students', studentId);
    const concessions = await this.getStudentConcessions(studentId);

    const activeConcessions = concessions.filter(
      (c) => c.isActive && c.status === 'approved'
    );

    const totalAmount = activeConcessions.reduce(
      (sum, c) => sum + (c.concessionAmount || 0),
      0
    );

    const statusMap = {
      pending: 'pending',
      approved: 'approved',
      rejected: 'rejected',
      none: 'none'
    };

    const currentStatus =
      activeConcessions.length > 0
        ? 'approved'
        : concessions.some((c) => c.status === 'pending')
        ? 'pending'
        : 'none';

    await updateDoc(studentRef, {
      totalConcessionAmount: totalAmount,
      activeConcessionCount: activeConcessions.length,
      concessionStatus: currentStatus,
      feeLastUpdated: serverTimestamp()
    });
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
        entityType: 'concession',
        entityId,
        studentId,
        changes,
        userId,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw - audit logging should not break main operation
    }
  }
};

export default concessionService;
