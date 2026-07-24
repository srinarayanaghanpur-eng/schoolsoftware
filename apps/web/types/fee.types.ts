// Fee and legacy concession types

export interface Student {
  id: string;
  admissionNumber: string;
  studentName: string;
  class: string;
  section: string;
  parentName: string;
  parentMobile: string;
  // Fee fields (new school fee model)
  annualEnrollmentFee: number;
  originalFeeAmount?: number;
  commitmentFee: number;
  committedPayableFee?: number;
  totalFeeAmount: number;
  totalFeesDue: number;
  totalFeesPaid: number;
  totalConcessionAmount?: number;
  lastPaymentDate: string | null;
  feeStatus: 'pending' | 'partial' | 'paid';
  attendancePercentage: number;
  feeHeads?: { name: string; original: number; committed: number }[];
  // Legacy concession summary fields (for backward compatibility)
  activeConcessionCount?: number;
  concessionStatus?: 'none' | 'pending' | 'approved' | 'rejected';
}

export interface Concession {
  id: string;
  studentId: string;
  admissionNumber: string;
  studentName: string;
  class: string;
  section: string;
  parentName: string;
  parentMobile: string;
  concessionType: 'percentage' | 'fixed';
  concessionAmount: number;
  concessionPercent: number;
  reason: string;
  attachments: string[];
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  approvalDate?: string;
  approvalNotes?: string;
  validFrom: string;
  validUpto: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  history?: ConcessionHistory[];
}

export interface ConcessionHistory {
  action: string;
  changedBy: string;
  changedAt: string;
  oldData?: Record<string, any>;
  newData?: Record<string, any>;
}

export interface FeeStructure {
  id: string;
  className: string;
  academicYearId: string;
  heads: { name: string; amount: number }[];
  total: number;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  receiptId?: string;
  admissionNumber: string;
  studentName: string;
  amountDue: number;
  amountPaid: number;
  remainingAmount: number;
  paymentType: string;
  feeType?: string;
  concessionApplied?: boolean;
  concessionId?: string;
  paymentDate: string;
  paymentMethod: 'cash' | 'cheque' | 'online' | 'transfer' | 'upi' | 'card' | 'bank_transfer';
  transactionId?: string;
  receiptNumber?: string;
  remarks?: string;
  recordedBy: string;
  status: 'pending' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface Receipt {
  id: string;
  receiptNo?: string;
  receiptNumber: string;
  paymentId: string;
  studentId: string;
  admissionNumber: string;
  studentName: string;
  class: string;
  section: string;
  amountPaid: number;
  paymentDate: string;
  receiptDate: string;
  issuedBy: string;
  pdfUrl?: string;
  status: 'draft' | 'issued' | 'cancelled';
  createdAt: string;
}

export interface DashboardStats {
  totalStudents: number;
  totalFeeAmount: number;
  totalFeeDue: number;
  totalFeeCollected: number;
  totalFeeOutstanding: number;
  studentsWithOutstandingFees: number;
  averageAnnualFee: number;
  pendingApprovals: number;
  monthlyCollection: number;
  // Legacy concession metrics (optional)
  studentsWithConcession?: number;
  totalConcessionAmount?: number;
  averageConcession?: number;
}

export interface FeeReport {
  type: 'class-wise' | 'student-wise' | 'attendance-fee';
  data: Record<string, any>[];
  generatedAt: string;
  generatedBy: string;
  filters?: {
    class?: string;
    dateRange?: { from: string; to: string };
    status?: string;
  };
}

export interface CreateConcessionPayload {
  studentId: string;
  admissionNumber: string;
  concessionType: 'percentage' | 'fixed';
  concessionAmount: number;
  concessionPercent: number;
  reason: string;
  attachments?: string[];
  validFrom: string;
  validUpto: string;
}

export interface UpdateConcessionPayload {
  status?: 'pending' | 'approved' | 'rejected';
  approvalNotes?: string;
  concessionAmount?: number;
  concessionPercent?: number;
  validUpto?: string;
}
