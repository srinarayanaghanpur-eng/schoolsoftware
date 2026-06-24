# Teacher Attendance and Salary Management System - Complete Schema

## Database Schema (Firestore)

### 1. **Users Collection** (`users/{uid}`)
Core authentication and profile data linked to Firebase Auth.

```typescript
{
  uid: string;                    // Firebase Auth UID
  email: string;
  role: "admin" | "teacher";     // Role-based access
  teacherId: string;             // Reference to teachers collection
  employeeId: string;            // Unique employee identifier
  fullName: string;
  status: "active" | "inactive" | "suspended";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastLoginAt: Timestamp;
  phoneNumber?: string;
}
```

### 2. **Teachers Collection** (`teachers/{teacherId}`)
Master data for all teachers with salary and configuration.

```typescript
{
  teacherId: string;             // UUID (primary key)
  employeeId: string;            // Unique identifier
  fullName: string;
  email: string;
  phoneNumber: string;
  subject?: string;
  
  // Salary Configuration
  baseMonthlySalary: number;     // Monthly salary in currency
  dateOfJoining: Timestamp;
  lastSalaryUpdate: Timestamp;
  
  // Leave Configuration
  casualLeaveBalance: number;    // Remaining CL balance (updated monthly/dynamically)
  casualLeaveAllowancePerMonth: number; // Default 1 or 2 CL per month
  totalCasualLeavesPerYear: number;    // Total CL allocation per year
  
  // Leave Tracking (current period)
  casualLeavesUsedThisMonth: number;
  casualLeaveDeductedThisMonth: number; // Due to absent/late
  
  // Attendance Tracking (current month)
  presentDaysThisMonth: number;
  lateDaysThisMonth: number;
  absentDaysThisMonth: number;
  lateEntriesCount: number;      // Cumulative late entries
  
  // Salary Tracking
  totalSalaryDeductionThisMonth: number;
  
  // Settings
  gpsRequired: boolean;
  biometricId?: string;
  customLateDeductionMode?: "none" | "half_day" | "fixed" | "after_3_lates_one_day";
  customFixedLateDeductionAmount?: number;
  
  // Status
  status: "active" | "inactive" | "suspended" | "left";
  suspensionReason?: string;
  
  // Metadata
  profilePhoto?: string;         // Cloud Storage path
  address?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 3. **Attendance Collection** (`attendance/{teacherId_YYYY-MM-DD}`)
Daily attendance records.

```typescript
{
  teacherId: string;
  date: string;                  // Format: YYYY-MM-DD
  month: string;                 // Format: YYYY-MM
  year: number;
  
  // Status and timing
  status: "present" | "late" | "absent" | "cl" | "holiday" | "not_marked";
  checkInTime?: Timestamp;       // First check-in time
  checkOutTime?: Timestamp;      // Last check-out time
  
  // Time tracking
  workingHours?: number;         // Hours worked
  isLate: boolean;
  lateMinutes?: number;          // How many minutes late
  
  // GPS Data
  checkInLatitude?: number;
  checkInLongitude?: number;
  distanceFromCampusMeters?: number;
  gpsVerified: boolean;
  
  // Source Tracking (multiple sources possible)
  source: "mobile" | "biometric" | "admin" | "manual";
  sourcesUsed: ("mobile" | "biometric")[];
  
  // Leave related
  leaveRequestId?: string;       // If marked as CL
  leaveReason?: string;
  
  // Audit trail
  adminEdited: boolean;
  editedBy?: string;             // Admin UID
  editReason?: string;
  originalStatus?: string;       // Before admin edit
  editedAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 4. **Monthly Attendance Summary** (`attendance_summary/{teacherId_YYYY-MM}`)
Aggregated monthly statistics for quick lookup and reporting.

```typescript
{
  teacherId: string;
  month: string;                 // Format: YYYY-MM
  year: number;
  
  // Attendance counts
  totalWorkingDays: number;      // Working days in month (excluding holidays)
  presentDays: number;
  lateDays: number;
  absentDays: number;
  notMarkedDays: number;
  holidayDays: number;
  
  // Late entry tracking
  lateEntriesCount: number;      // Total late entries
  casualLeavesDeductedFromLates: number; // Calculated: lateEntriesCount / 3
  
  // Casual Leave tracking
  casualLeavesUsed: number;      // Leave requests approved
  casualLeavesDeductedFromAbsent: number; // 1 per absent day
  casualLeaveBalanceBefore: number;
  casualLeaveBalanceAfter: number;
  
  // Salary calculation
  perDaySalary: number;
  perHourSalary: number;
  baseSalary: number;
  totalSalaryDeduction: number;
  finalPayableSalary: number;
  
  // Deductions breakdown
  deductionFromLates: number;
  deductionFromAbsent: number;
  deductionFromExhaustedCL: number;
  manualDeduction: number;
  bonus: number;
  
  // Status
  isFinalized: boolean;
  finalizedAt?: Timestamp;
  isPaid: boolean;
  paidAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 5. **Casual Leave Tracking** (`casual_leave_transactions/{teacherId_YYYY-MM-DD}`)
Log each CL deduction and usage for audit trail.

```typescript
{
  transactionId: string;         // UUID
  teacherId: string;
  month: string;
  date: string;                  // Date of deduction/usage
  
  type: "deduction" | "usage" | "correction" | "monthly_allowance";
  reason: "absent" | "excessive_lates" | "leave_request" | "admin_adjustment" | "monthly_allocation";
  
  // For excessive lates
  lateEntriesCount?: number;
  casualLeavesDeducted: number;  // How many CLs deducted (usually 1)
  
  // Reference IDs
  attendanceId?: string;         // If related to attendance
  leaveRequestId?: string;       // If related to leave request
  
  // Pre and post state
  balanceBefore: number;
  balanceAfter: number;
  
  // Metadata
  createdBy?: string;            // User UID who created (admin or system)
  notes?: string;
  createdAt: Timestamp;
}
```

### 6. **Leave Requests** (`leave_requests/{requestId}`)
Teacher leave requests with approval workflow.

```typescript
{
  requestId: string;             // UUID
  teacherId: string;
  
  // Leave details
  leaveType: "casual" | "sick" | "vacation" | "maternity" | "other";
  startDate: string;             // Format: YYYY-MM-DD
  endDate: string;
  totalDays: number;             // Calculated: number of working days
  reason: string;
  
  // Approval workflow
  status: "pending" | "approved" | "rejected" | "cancelled";
  submittedAt: Timestamp;
  approvedAt?: Timestamp;
  approvedBy?: string;           // Admin UID
  rejectionReason?: string;
  
  // Attendance update
  attendanceUpdated: boolean;    // Whether attendance records updated to "cl"
  updatedAt?: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
  modifiedAt: Timestamp;
}
```

### 7. **Salary Reports** (`salary_reports/{teacherId_YYYY-MM}`)
Monthly salary calculations and payment tracking.

```typescript
{
  reportId: string;              // Format: YYYY-MM_teacherId
  teacherId: string;
  month: string;                 // Format: YYYY-MM
  year: number;
  
  // Teacher info snapshot
  teacherName: string;
  employeeId: string;
  
  // Salary components
  baseSalary: number;
  totalWorkingDays: number;
  perDaySalary: number;
  
  // Attendance based deductions
  presentDays: number;
  lateDays: number;
  absentDays: number;
  
  // Deduction calculations
  deductionFromAbsent: number;   // absentDays × perDaySalary
  deductionFromLates: number;    // Calculated based on mode
  deductionFromExhaustedCL: number;
  manualDeduction: number;
  totalDeduction: number;
  
  // Additions
  bonus: number;
  
  // Final salary
  netSalary: number;             // baseSalary - totalDeduction + bonus
  
  // Payment status
  status: "draft" | "calculated" | "approved" | "paid" | "cancelled";
  isApproved: boolean;
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  isPaid: boolean;
  paidAt?: Timestamp;
  paymentMethod?: "bank_transfer" | "check" | "cash";
  paymentReference?: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  remarks?: string;
}
```

### 8. **School Settings** (`school_settings/{settingId}`)
Global configuration for the institution.

```typescript
{
  settingId: string;             // Usually "default"
  
  // School info
  schoolName: string;
  schoolCode: string;
  academicYear: string;          // e.g., "2024-2025"
  
  // Location
  campusLatitude: number;
  campusLongitude: number;
  geofenceRadiusMeters: number;
  
  // Working hours
  schoolStartTime: string;       // Format: HH:MM (e.g., "09:00")
  schoolEndTime: string;         // Format: HH:MM (e.g., "17:00")
  graceMinutesForLate: number;   // Grace period (e.g., 10 minutes)
  
  // Salary and leave rules
  workingDaysPerWeek: number;    // Usually 5 or 6
  weeklyOffDay: string;          // e.g., "Sunday" or "Saturday"
  totalWorkingDaysPerMonth: number;
  
  // Late deduction configuration
  defaultLateDeductionMode: "none" | "half_day" | "fixed" | "after_3_lates_one_day";
  fixedLateDeductionAmount: number; // If mode is "fixed"
  latesBeforeCLDeduction: number; // Usually 3 (every 3 lates = 1 CL)
  
  // CL configuration
  casualLeaveAllowancePerMonth: number;
  totalCasualLeavesPerYear: number;
  casualLeaveCarryForwardDays: number;
  
  // Absent policy
  consecutiveAbsentsForAction: number; // After how many days trigger action
  
  // Notifications
  enableNotifications: boolean;
  lateNotificationThreshold: number; // Minutes after which to notify
  
  // GPS Configuration
  gpsMandatory: boolean;
  gpsVerificationEnabled: boolean;
  
  // Biometric Configuration
  biometricEnabled: boolean;
  biometricDeviceIds: string[]; // Connected ESSL device IDs
  
  // System
  timezone: string;             // e.g., "Asia/Kolkata"
  dateFormat: string;           // e.g., "DD-MM-YYYY"
  currencySymbol: string;
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy: string;            // Admin UID
}
```

### 9. **Holidays** (`holidays/{holidayId}`)
School holidays and public holidays.

```typescript
{
  holidayId: string;
  date: string;                  // Format: YYYY-MM-DD
  name: string;
  type: "public" | "school" | "exam" | "summer_break";
  description?: string;
  
  // Applicability
  applicableToAll: boolean;
  applicableTo?: string[];       // Teacher IDs if not applicable to all
  
  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### 10. **Audit Logs** (`admin_audit_logs/{logId}`)
Complete audit trail of all admin actions.

```typescript
{
  logId: string;
  adminId: string;               // Admin UID
  adminName: string;
  action: string;                // e.g., "mark_attendance", "approve_leave", "modify_salary"
  
  // Resource affected
  resourceType: "teacher" | "attendance" | "leave_request" | "salary_report" | "holiday";
  resourceId: string;
  relatedTeacherId?: string;
  
  // Change details
  changes: {
    field: string;
    oldValue: any;
    newValue: any;
  }[];
  
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  
  // Metadata
  timestamp: Timestamp;
  status: "success" | "failure";
  errorMessage?: string;
}
```

### 11. **Attendance Edit Audit Logs** (`attendance_edit_audit_logs/{logId}`)
Specific audit trail for attendance modifications.

```typescript
{
  logId: string;
  teacherId: string;
  attendanceId: string;
  date: string;
  
  adminId: string;
  adminName: string;
  
  // Original data
  originalStatus: string;
  originalCheckInTime?: Timestamp;
  originalCheckOutTime?: Timestamp;
  originalSource?: string;
  
  // New data
  newStatus: string;
  newCheckInTime?: Timestamp;
  newCheckOutTime?: Timestamp;
  newSource?: string;
  
  // Reason and notes
  editReason: string;
  notes?: string;
  
  // Metadata
  editedAt: Timestamp;
  approvedBy?: string;           // If approval required
  approvedAt?: Timestamp;
}
```

### 12. **Biometric Logs** (`biometric_logs/{logId}`)
Raw logs from ESSL or biometric devices.

```typescript
{
  logId: string;
  deviceId: string;
  biometricUserId: string;       // User ID on device (maps to teacherId)
  
  // Verification details
  verificationType: "fingerprint" | "face" | "iris" | "rfid";
  verificationTime: Timestamp;
  verificationStatus: "success" | "failure" | "duplicate";
  
  // Device response
  rawPayload: any;              // Raw device response
  processedAt: Timestamp;
  
  // Metadata
  createdAt: Timestamp;
}
```

## Key Relationships and Cascading Updates

### Late Entry to CL Deduction Flow:
```
1. Attendance marked as "late" (checkInTime > schoolStartTime + grace)
2. lateEntriesCount incremented in teachers collection
3. Monthly attendance_summary updated with lateEntriesCount
4. When lateEntriesCount % 3 == 0:
   - CL deduction transaction logged
   - casualLeaveBalance decremented
   - Monthly attendance_summary updated
5. If CL balance exhausted: Salary deduction applied
```

### Absence to CL Deduction Flow:
```
1. Attendance marked as "absent"
2. Monthly attendance_summary: absentDays++
3. CL deduction transaction created (1 per absent day)
4. casualLeaveBalance decremented
5. Salary deduction calculated in salary_reports
```

### Salary Calculation Flow:
```
1. Fetch teacher's baseSalary
2. Calculate working days (total - holidays - weekends)
3. perDaySalary = baseSalary / workingDays
4. Apply all deductions:
   - From absents: absentDays × perDaySalary
   - From lates: based on deductionMode
   - From exhausted CL: (usedCL - allowance) × perDaySalary
   - Manual deductions
5. Add bonuses
6. netSalary = baseSalary - totalDeductions + bonus
```

## Indexing Strategy for Performance

### Recommended Firestore Indexes:
```
1. Collection: attendance
   Fields: [teacherId (Asc), date (Desc)]
   
2. Collection: attendance_summary
   Fields: [month (Desc), createdAt (Desc)]
   
3. Collection: salary_reports
   Fields: [month (Desc), status (Asc)]
   
4. Collection: leave_requests
   Fields: [teacherId (Asc), status (Asc), submittedAt (Desc)]
   
5. Collection: admin_audit_logs
   Fields: [resourceType (Asc), timestamp (Desc)]
   
6. Collection: casual_leave_transactions
   Fields: [teacherId (Asc), date (Desc)]
```

## Data Validation Rules

- **Salary**: Must be > 0
- **Late Deduction**: Must be non-negative
- **CL Balance**: Cannot go below 0 (system prevents further deductions when exhausted)
- **Attendance Status**: Only valid statuses allowed
- **Dates**: Must be in YYYY-MM-DD format
- **Times**: Must be in HH:MM format
- **GPS**: If mandatory, distance must be within geofence_radius
