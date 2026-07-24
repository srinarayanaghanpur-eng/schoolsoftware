import type { Role } from "./rbac";

export type UserRole = Role;

export type AcademicYear = {
  id?: string;
  name: string; // e.g. "2026-27"
  startDate: string; // ISO date (YYYY-MM-DD)
  endDate: string; // ISO date (YYYY-MM-DD)
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type TeacherStatus = "active" | "inactive";

// Employment type drives the check-in/out time windows and salary basis.
export type EmploymentType = "full_time" | "part_time_morning" | "part_time_afternoon";
export type RequestStatus = "open" | "resolved" | "rejected";
export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export type AttendanceStatus =
  | "present"
  | "late"
  | "cl"
  | "holiday"
  | "absent"
  | "not_marked"
  | "checked_in"
  | "half_day"
  | "short_hours";

export type AttendanceSource = "mobile" | "biometric" | "admin" | "system";

export type AttendanceEventType = "checkin" | "checkout";

export type VerificationType = "face" | "fingerprint" | "card" | "pin" | "unknown";

export type LateDeductionMode = "none" | "half_day" | "fixed" | "after_3_lates_one_day";

export type FirestoreDate = string;

export type AppUser = {
  uid: string;
  role: UserRole;
  teacherId?: string;
  email?: string;
  employeeId?: string;
  internalEmail?: string;
  displayName: string;
  status?: TeacherStatus;
  createdAt: FirestoreDate;
  updatedAt?: FirestoreDate;
};

export type Teacher = {
  id: string;
  uid?: string;
  fullName: string;
  email?: string;
  internalEmail: string;
  phone: string;
  subject: string;
  employeeId: string;
  employeeIdLower?: string;
  biometricUserId?: string;
  baseSalary: number;
  joiningDate: string;
  status: TeacherStatus;
  role?: "teacher";
  employmentType?: EmploymentType;
  allowedCLPerMonth: number;
  lateDeductionRule: LateDeductionMode;
  // CL Tracking (new fields)
  casualLeaveBalance: number;
  casualLeaveUsedThisMonth: number;
  lateEntriesThisMonth: number;
  absentDaysThisMonth: number;
  clResetDate?: string; // Last reset date for monthly CL
  // GPS & Device
  gpsEnabled?: boolean;
  gpsLatitude?: number;
  gpsLongitude?: number;
  gpsRadiusMeters?: number;
  profilePhotoUrl?: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type GpsPoint = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
};

export type AttendanceRecord = {
  teacherId: string;
  date: string;
  month: string;
  year: number;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  source: AttendanceSource;
  sourcesUsed: AttendanceSource[];
  latitude?: number;
  longitude?: number;
  distanceFromCampus?: number;
  deviceInfo?: string;
  biometricDeviceId?: string;
  lateMinutes: number;
  isLate: boolean;
  remarks?: string;
  adminEdited: boolean;
  editedBy?: string;
  editReason?: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type AttendanceLog = {
  id?: string;
  teacherId: string;
  date: string;
  timestamp: string;
  source: AttendanceSource;
  eventType: AttendanceEventType;
  latitude?: number;
  longitude?: number;
  distanceFromCampus?: number;
  deviceInfo?: string;
  rawData?: unknown;
  createdAt: FirestoreDate;
};

// Monthly attendance summary for efficient calculations
export type AttendanceSummary = {
  id: string; // Format: "{teacherId}_{month}" e.g., "T001_2026-06"
  teacherId: string;
  month: string; // Format: YYYY-MM
  year: number;
  presentDays: number;
  lateDays: number;
  lateEntries: number; // Count of late entries for CL calculation
  absentDays: number;
  clDays: number;
  holidayDays: number;
  workingDays: number;
  clUsedFromAbsent: number; // absents × 1
  clUsedFromLate: number; // floor(lateEntries / 3)
  totalClUsed: number; // absentDays + floor(lateEntries / 3)
  remainingCl: number; // max(0, 3 - totalClUsed)
  excessLeave: number; // max(0, totalClUsed - 3)
  updatedAt: FirestoreDate;
};

export type PasswordResetRequest = {
  id?: string;
  loginId: string;
  employeeId?: string;
  teacherId?: string;
  teacherName?: string;
  status: RequestStatus;
  requestedAt: FirestoreDate;
  resolvedAt?: FirestoreDate;
  resolvedBy?: string;
  adminNote?: string;
};

export type PasswordResetHistory = {
  id?: string;
  teacherId: string;
  teacherName: string;
  employeeId: string;
  resetBy: string;
  resetAt: FirestoreDate;
  requestId?: string;
  note?: string;
};

export type LeaveRequest = {
  id?: string;
  teacherId: string;
  teacherName: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveRequestStatus;
  requestedAt: FirestoreDate;
  reviewedAt?: FirestoreDate;
  reviewedBy?: string;
  adminNote?: string;
  attendanceUpdated?: boolean;
};

export type AttendanceEditAudit = {
  id?: string;
  attendanceId: string;
  teacherId: string;
  date: string;
  previousStatus?: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  editedBy: string;
  editedAt: FirestoreDate;
};

export type BiometricLog = {
  id?: string;
  deviceId: string;
  biometricUserId: string;
  teacherId?: string;
  timestamp: string;
  verificationType: VerificationType;
  eventType: AttendanceEventType;
  rawPayload: unknown;
  processed: boolean;
  errorMessage?: string;
  createdAt: FirestoreDate;
};

export type SalaryRules = {
  lateDeductionMode: LateDeductionMode;
  fixedLateDeductionAmount: number;
  afterLateCountDeductDays: number;
  manualDeductionDefault: number;
  bonusDefault: number;
};

export type SchoolSettings = {
  schoolName: string;
  campusLatitude: number;
  campusLongitude: number;
  geofenceRadiusMeters: number;
  schoolStartTime: string;
  graceMinutes: number;
  salaryRules: SalaryRules;
  biometricApiSecret?: string;
  timezone: string;
};

export type Holiday = {
  id?: string;
  date: string;
  title: string;
  type: "public" | "school" | "exam" | "other" | "management_declared";
  createdAt: FirestoreDate;
  // Management-declared holiday fields
  reason?: string;
  declaredByUserId?: string;
  declaredByName?: string;
  declaredAt?: FirestoreDate;
  branchId?: string; // specific branch code, empty = all branches
  appliesToAllBranches?: boolean;
  isActive?: boolean; // false = cancelled; missing means active
  cancelledByUserId?: string;
  cancelledAt?: FirestoreDate;
};

export type SalaryReport = {
  teacherId: string;
  teacherName: string;
  subject: string;
  employeeId: string;
  month: string;
  year: number;
  // Attendance Data
  totalCalendarDays: number;
  totalWorkingDaysInMonth?: number;
  workingDaysElapsed?: number;
  payrollFinalized?: boolean;
  calculationAsOfDate?: string;
  workingDays: number;
  presentDays: number;
  lateDays: number;
  lateEntries: number; // Late check-ins are still present days; retained for reporting.
  clDays: number;
  absentDays: number;
  holidays: number;
  managementHolidayDays?: number; // active management-declared holidays in the month
  managementHolidayInfo?: string; // formatted "date (reason)" list for reports/Excel
  // Salary Calculation
  baseSalary: number;
  perDaySalary: number;
  // CL Tracking
  clAllowanceThisMonth: number; // Usually 3
  clUsedFromAbsent: number; // approved paid CL days with no check-in
  clUsedFromLate: number; // Always 0 for earned-days payroll.
  totalClUsed: number; // approved paid CL days consumed this month
  remainingCl: number; // max(0, allowance - totalClUsed)
  excessLeave: number; // approved leave days beyond the paid CL allowance
  // New CL/leave breakdown
  approvedLeaveCLDays: number; // approved leave days with no check-in
  attendedApprovedLeaveDays: number; // approved leave days where check-in exists
  lateDerivedCLDays: number; // Always 0 for earned-days payroll.
  paidCLDays: number; // approved leave days paid from monthly CL allowance
  approvedPaidCLDays: number; // approved leave days without check-in paid from CL
  paidLeaveDays?: number; // approved leave days paid from remaining CL balance
  paidHolidayDays?: number; // paid holidays included in paid-day reconciliation when applicable
  excessCLDays: number; // max(totalClUsed - allowance, 0)
  plainAbsentDays: number; // working days with no check-in and no approved leave
  unpaidAbsentDays: number; // plain absences + approved leave beyond CL balance
  unpaidDeductionDays: number; // alias for unpaidAbsentDays used by older consumers
  earnedPaidDays: number; // presentDays + approvedPaidCLDays
  grossEarnedSalary: number; // earnedPaidDays × perDaySalary
  approvedLeaveRequests: LeaveRequest[]; // approved leave requests for this month
  approvedLeaveInfo: string; // formatted leave info for Excel
  salaryDeduction: number; // (plain absent days + excess CL days) × perDaySalary
  // Deductions (detailed breakdown)
  absentDeduction: number;
  lateDeduction: number;
  excessLeaveDeduction: number; // excessCLDays × perDaySalary
  manualDeduction: number;
  bonus: number;
  totalDeduction: number; // salaryDeduction + manualDeduction for reporting
  // Final Salary
  netPayable: number; // grossEarnedSalary + bonus - manualDeduction
  // Payment Status
  paid: boolean;
  paidAt?: string;
  paymentNotes?: string;
  salaryStatus?: "Ready" | "Attendance Missing" | "Invalid";
  attendanceDataAvailable?: boolean;
  paymentBlockedReason?: string;
  calculationWarning?: string;
  presentDates?: string[];
  absentDates?: string[];
  approvedLeaveDates?: string[];
  lateDates?: string[];
  calculationDebug?: PayrollCalculationDebug;
  generatedAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type PayrollCalculationDebug = {
  staffId: string;
  staffName: string;
  month: string;
  totalWorkingDaysInMonth: number;
  workingDaysElapsed: number;
  presentDates: string[];
  absentDates: string[];
  managementHolidayDates?: string[];
  approvedLeaveDates: string[];
  attendedApprovedLeaveDates: string[];
  lateDates: string[];
  paidLeaveDays: number;
  approvedPaidCLDays: number;
  paidHolidayDays?: number;
  unpaidAbsentDays: number;
  excessCLDays: number;
  earnedPaidDays: number;
  grossEarnedSalary: number;
  dailyRate: number;
  deduction: number;
  netPayable: number;
};

export type DashboardSummary = {
  totalTeachers: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  clToday: number;
  notMarkedToday: number;
  totalSalaryPayable: number;
  salaryPaid: number;
  salaryPending: number;
  biometricEntriesToday: number;
  mobileEntriesToday: number;
};

// ===== Phase 2: Exams & Marks =====
export type ExamType = "unit_test" | "midterm" | "final" | "olympiad" | "other";
export type ExamStatus = "scheduled" | "ongoing" | "completed" | "published";

export type ExamTimetableEntry = {
  subject: string;
  date: string; // ISO date
  time: string; // e.g. "09:00 AM"
  maxMarks?: number; // override default exam maxMarks per subject
};

export type Exam = {
  id?: string;
  name: string; // e.g. "Unit Test 1"
  academicYearId: string;
  className: string; // e.g. "10"
  section?: string; // e.g. "A" (omit = whole class)
  examType: ExamType;
  startDate: string; // ISO date
  endDate?: string;
  maxMarks: number; // default per-subject max
  timetable?: ExamTimetableEntry[];
  status: ExamStatus;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type ExamReportCard = {
  studentId: string;
  studentName: string;
  className: string;
  section?: string;
  examName: string;
  subjects: {
    subject: string;
    marksObtained: number;
    maxMarks: number;
    grade?: string;
    remarks?: string;
  }[];
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  grade?: string;
  rank?: number;
  remarks?: string;
};

export type ExamMark = {
  id?: string;
  examId: string;
  studentId: string;
  subject: string;
  marksObtained: number;
  maxMarks: number;
  grade?: string;
  remarks?: string;
  updatedAt: FirestoreDate;
};

// ===== Homework (Phase 3) =====
export type HomeworkStatus = "active" | "completed" | "cancelled";
export type HomeworkSubmissionStatus = "pending" | "submitted" | "graded";

export type Homework = {
  id?: string;
  title: string;
  description: string;
  subject: string;
  className: string;
  section?: string;
  assignedBy: string;
  assignedDate: string;
  dueDate: string;
  attachments: { name: string; url: string }[];
  status: HomeworkStatus;
  academicYearId: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type HomeworkSubmission = {
  id?: string;
  homeworkId: string;
  studentId: string;
  studentName: string;
  submissionDate: string;
  content?: string;
  attachments: { name: string; url: string }[];
  status: HomeworkSubmissionStatus;
  grade?: string;
  remarks?: string;
  gradedBy?: string;
  gradedAt?: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

// ===== Phase 2: Communication (notices / circulars) =====
export type NoticeChannel = "app" | "whatsapp" | "email";
export type NoticeCategory = "school" | "branch" | "class" | "holiday" | "exam" | "event" | "fee" | "emergency";

export type Notice = {
  id?: string;
  title: string;
  body: string;
  category: NoticeCategory;
  audienceRoles: UserRole[]; // empty = everyone
  audienceClasses: string[]; // empty = all classes
  branch?: string; // specific branch code, empty = all branches
  channels: NoticeChannel[]; // "app" delivered now; others queued for integration
  academicYearId?: string;
  createdBy: string; // uid
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

// ===== Phase 3: Fee structure, online payment, portal =====
export type FeeHead = { name: string; amount: number };

export type FeeStructure = {
  id?: string;
  academicYearId: string;
  className: string;
  heads: FeeHead[];
  total: number;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type PaymentOrderStatus = "created" | "paid" | "failed" | "cancelled";

export type PaymentOrder = {
  id?: string;
  studentId: string;
  amount: number;
  paymentType: string; // e.g. "tuition", "term-1"
  status: PaymentOrderStatus;
  provider: string; // "manual" | "razorpay" | "upi" ... (integration point)
  providerOrderId?: string;
  note?: string;
  createdBy: string; // uid of payer
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

// Portal: a parent/student user is linked to one or more student records.
export type PortalSummary = {
  student: { id: string; name: string; className: string; section?: string };
  fees: { total: number; paid: number; due: number; status?: string };
  attendancePercentage?: number;
  marks: { examName: string; subject: string; marksObtained: number; maxMarks: number; grade?: string }[];
  notices: { title: string; body: string; createdAt?: string }[];
  recentPayments?: { id: string; amountPaid: number; paymentMethod: string; receiptNumber: string; createdAt: string }[];
};

// ===== Finance & Accounting =====
export type ExpenseStatus = "pending" | "approved" | "rejected";
export type FinancePaymentMethod = "cash" | "bank" | "upi" | "cheque" | "card" | "other";
export type DebitVoucherStatus = "active" | "cancelled";

export type Expense = {
  id?: string;
  category: string; // utilities | maintenance | supplies | vendor | salary_advance | other
  amount: number;
  date: string; // ISO date YYYY-MM-DD
  description: string;
  vendor?: string;
  paymentMethod: FinancePaymentMethod;
  status: ExpenseStatus;
  approvedBy?: string;
  academicYearId?: string;
  createdBy: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type DebitVoucher = {
  id?: string;
  voucherNo: number;
  voucherKey?: string;
  academicYear: string;
  academicYearId?: string;
  date: string;
  paidTo: string;
  paidToLower?: string;
  towards: string;
  amount: number;
  amountInWords: string;
  expenseCategory: string;
  paymentMode: FinancePaymentMethod;
  cashAccountId?: string;
  bankAccountId?: string;
  expenseId?: string;
  bankTransactionId?: string;
  notes?: string;
  createdByUserId: string;
  createdByUsername?: string;
  createdAt: FirestoreDate;
  printedAt?: FirestoreDate;
  printCount: number;
  status: DebitVoucherStatus;
};

export type Income = {
  id?: string;
  category: string; // donation | rent | grant | misc
  amount: number;
  date: string;
  description: string;
  source?: string;
  paymentMethod: FinancePaymentMethod;
  academicYearId?: string;
  createdBy: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type SalaryAdvance = {
  id?: string;
  teacherId: string;
  teacherName?: string;
  amount: number;
  date: string;
  reason?: string;
  recovered: boolean;
  academicYearId?: string;
  createdBy: string;
  createdAt: FirestoreDate;
};

export type LedgerEntry = {
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  source: "fee" | "income" | "expense" | "salary" | "advance";
  refId?: string;
};

export type FinanceSummary = {
  from: string;
  to: string;
  income: { fees: number; other: number; total: number };
  expense: { general: number; salary: number; advances: number; total: number };
  net: number;
};

export type ClassDues = {
  className: string;
  studentCount: number;
  totalDue: number;
  students: { id: string; name: string; due: number }[];
};

export type DigitalFeeReceiptItem = {
  type: "Tuition Fee" | "Transport / Bus Fee" | "Books / Uniform / Other";
  periodOrMonth: string;
  amount: number;
  remarks: string;
};

export type DigitalFeeReceipt = {
  id?: string;
  receiptNo: string;
  receiptNumber?: string;
  paymentId: string;
  academicYear: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  className: string;
  section: string;
  parentName: string;
  mobile: string;
  paymentDate: FirestoreDate;
  paymentMode: string;
  feeItems: DigitalFeeReceiptItem[];
  totalPaid: number;
  balanceDue: number;
  createdByUserId: string;
  createdByUsername: string;
  createdAt: FirestoreDate;
  printedAt?: FirestoreDate;
  printCount: number;
  status?: "issued" | "cancelled";
};

// ===== Installment Plans =====
export type InstallmentStatus = "pending" | "paid" | "overdue" | "cancelled";

export type Installment = {
  number: number;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  status: InstallmentStatus;
  paidDate?: string;
  paymentId?: string;
};

export type InstallmentPlan = {
  id?: string;
  studentId: string;
  studentName?: string;
  totalAmount: number;
  paidAmount: number;
  installments: Installment[];
  academicYearId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

// ===== Finance: vendors, purchases, banking, invoices, reminders =====
export type Vendor = {
  id?: string;
  name: string;
  contact?: string;
  phone?: string;
  address?: string;
  gstin?: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type PurchaseStatus = "unpaid" | "partial" | "paid";
export type PurchaseItem = { name: string; qty: number; rate: number; amount: number };

export type Purchase = {
  id?: string;
  vendorId: string;
  vendorName?: string;
  billNo?: string;
  date: string;
  items: PurchaseItem[];
  amount: number;
  amountPaid: number;
  status: PurchaseStatus;
  category?: string;
  academicYearId?: string;
  createdBy: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type BankAccount = {
  id?: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  openingBalance: number;
  currentBalance: number;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

export type BankTxnType = "deposit" | "withdrawal" | "transfer";
export type BankTransaction = {
  id?: string;
  accountId: string;
  type: BankTxnType;
  amount: number;
  date: string;
  description?: string;
  toAccountId?: string;
  createdBy: string;
  createdAt: FirestoreDate;
};

export type InvoiceStatus = "issued" | "paid" | "cancelled";
export type Invoice = {
  id?: string;
  invoiceNo: string;
  studentId: string;
  studentName?: string;
  items: { name: string; amount: number }[];
  total: number;
  status: InvoiceStatus;
  date: string;
  academicYearId?: string;
  createdBy: string;
  createdAt: FirestoreDate;
};

// ===== Phase 4: Transport =====
export type Vehicle = { id?: string; regNo: string; model?: string; capacity: number; driverName?: string; driverPhone?: string; createdAt: FirestoreDate; updatedAt: FirestoreDate };
export type RouteStop = { name: string; fee: number };
export type TransportRoute = { id?: string; name: string; vehicleId?: string; stops: RouteStop[]; createdAt: FirestoreDate; updatedAt: FirestoreDate };
export type TransportAssignment = { id?: string; studentId: string; studentName?: string; routeId: string; stopName: string; fee: number; createdAt: FirestoreDate };

// ===== Phase 4: Library =====
export type Book = { id?: string; title: string; author?: string; isbn?: string; category?: string; copies: number; available: number; createdAt: FirestoreDate; updatedAt: FirestoreDate };
export type LibraryIssueStatus = "issued" | "returned";
export type LibraryIssue = { id?: string; bookId: string; bookTitle?: string; memberType: "student" | "staff"; memberId: string; memberName?: string; issueDate: string; dueDate: string; returnDate?: string; fine: number; status: LibraryIssueStatus; createdAt: FirestoreDate };

// ===== Phase 4: Hostel =====
export type HostelRoom = { id?: string; number: string; type?: string; capacity: number; occupied: number; createdAt: FirestoreDate; updatedAt: FirestoreDate };
export type HostelAllotment = { id?: string; studentId: string; studentName?: string; roomId: string; roomNumber?: string; fromDate: string; toDate?: string; status: "active" | "vacated"; createdAt: FirestoreDate };

// ===== Phase 4: Inventory / Store =====
export type InventoryItem = { id?: string; name: string; category?: string; stock: number; unitPrice: number; createdAt: FirestoreDate; updatedAt: FirestoreDate };
export type InventorySale = { id?: string; itemId: string; itemName?: string; qty: number; amount: number; buyer?: string; date: string; createdBy: string; createdAt: FirestoreDate };

// ===== Phase 4: Promotion =====
export type PromotionType = "promote" | "detain" | "section_change";
export type PromotionStatus = "pending" | "approved" | "completed" | "rejected";

export type PromotionRecord = {
  id?: string;
  promotionType: PromotionType;
  academicYearId: string;
  fromAcademicYearId?: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  fromClass: string;
  fromSection: string;
  toClass?: string;
  toSection?: string;
  feeBalanceCarriedForward: number;
  notes?: string;
  status: PromotionStatus;
  approvalId?: string;
  approvedBy?: string;
  approvedAt?: FirestoreDate;
  createdBy: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

// ===== Phase 0: Audit Log System =====
export type AuditAction =
  | "admission.created"
  | "student.edited"
  | "fee.collected"
  | "receipt.cancelled"
  | "concession.added"
  | "concession.updated"
  | "expense.added"
  | "expense.deleted"
  | "expense.approved"
  | "expense.rejected"
  | "student.promoted"
  | "student.suspended"
  | "tc.issued"
  | "salary.approved"
  | "user.login"
  | "user.logout"
  | "attendance.edited"
  | "approval.created"
  | "approval.approved"
  | "approval.rejected"
  | "teacher.created"
  | "teacher.updated"
  | "backup.created"
  | "data.erased"
  | string; // allow custom actions

export type AuditLogEntry = {
  id?: string;
  action: AuditAction;
  entityType: string; // e.g. "attendance", "student", "fee", "expense"
  entityId: string;
  actorId: string;
  actorRole: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  branch?: string;
  deviceInfo?: string;
  ipAddress?: string;
  approvalId?: string;
  academicYearId?: string;
  createdAt: FirestoreDate;
};

// ===== Phase 0: Approval Workflow Engine =====
export type ApprovalRequestType =
  | "concession"
  | "expense"
  | "receipt_cancel"
  | "promotion"
  | "tc_issue"
  | "salary"
  | "student_delete"
  | "data_edit"
  | "profile_update"
  | string;

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ApprovalRequest = {
  id?: string;
  requestType: ApprovalRequestType;
  entityType: string;
  entityId: string;
  title: string;
  description?: string;
  requestedBy: string;
  requestedByName?: string;
  requestedAt: FirestoreDate;
  status: ApprovalStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: FirestoreDate;
  notes?: string;
  payload?: Record<string, unknown>;
  branch?: string;
  academicYearId?: string;
};

// ===== Phase 0: Branch / Multi-school Context =====
export type BranchInfo = {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

// ===== Phase 0: Parent ↔ Student Linkage =====
export type ParentStudentLink = {
  id?: string;
  parentUid: string;
  studentId: string;
  relationship: "father" | "mother" | "guardian" | "other";
  isPrimary: boolean;
  createdAt: FirestoreDate;
};

// ===== Parent Messages =====
export type ParentMessageType = "enquiry" | "support_ticket" | "complaint" | "meeting_request";
export type ParentMessageStatus = "open" | "in_progress" | "resolved";

export type ParentMessage = {
  id?: string;
  parentUid: string;
  parentName?: string;
  studentId: string;
  studentName?: string;
  type: ParentMessageType;
  subject: string;
  body: string;
  status: ParentMessageStatus;
  reply?: string;
  repliedBy?: string;
  repliedAt?: FirestoreDate;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

// ===== Fee Reminder =====
export type FeeReminder = {
  id?: string;
  studentId: string;
  studentName?: string;
  className?: string;
  amount: number;
  dueDate: string;
  note?: string;
  sent: boolean;
  sentAt?: FirestoreDate;
  createdBy: string;
  createdAt: FirestoreDate;
};

// ===== Timetable (Phase 4) =====
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TimetableEntry = {
  id?: string;
  className: string;
  section?: string;
  academicYearId: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacherId?: string;
  teacherName?: string;
  room?: string;
  isBreak?: boolean;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};

// ===== Certificates (Phase 9) =====
export type CertificateType = "transfer" | "character" | "bonafide" | "conduct" | "general";
export type CertificateStatus = "draft" | "issued" | "cancelled";

export type Certificate = {
  id?: string;
  certificateType: CertificateType;
  certificateNumber: string;
  studentId: string;
  studentName: string;
  className: string;
  section?: string;
  academicYearId: string;
  issueDate: string;
  template?: string;
  data: Record<string, string>;
  status: CertificateStatus;
  issuedBy: string;
  issuedByName?: string;
  remarks?: string;
  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
};
