export type UserRole = "admin" | "teacher";

export type TeacherStatus = "active" | "inactive";
export type RequestStatus = "open" | "resolved" | "rejected";
export type LeaveRequestStatus = "pending" | "approved" | "rejected";

export type AttendanceStatus =
  | "present"
  | "late"
  | "cl"
  | "holiday"
  | "absent"
  | "not_marked";

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
  type: "public" | "school" | "exam" | "other";
  createdAt: FirestoreDate;
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
  workingDays: number;
  presentDays: number;
  lateDays: number;
  lateEntries: number; // For CL calculation: floor(lateEntries / 3)
  clDays: number;
  absentDays: number;
  holidays: number;
  // Salary Calculation
  baseSalary: number;
  perDaySalary: number;
  // CL Tracking
  clAllowanceThisMonth: number; // Usually 3
  clUsedFromAbsent: number; // absents × 1
  clUsedFromLate: number; // floor(lateEntries / 3)
  totalClUsed: number; // absents + floor(lateEntries / 3)
  remainingCl: number; // max(0, 3 - totalClUsed)
  excessLeave: number; // max(0, totalClUsed - 3)
  // Deductions (detailed breakdown)
  absentDeduction: number; // 0 if absents <= allowance, else excess × perDaySalary
  lateDeduction: number; // 0 (lates only consume CL, not salary unless excess)
  excessLeaveDeduction: number; // excessLeave × perDaySalary
  manualDeduction: number;
  bonus: number;
  totalDeduction: number; // Sum of all deductions
  // Final Salary
  netPayable: number; // baseSalary - totalDeduction + bonus
  // Payment Status
  paid: boolean;
  paidAt?: string;
  paymentNotes?: string;
  generatedAt: FirestoreDate;
  updatedAt: FirestoreDate;
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
