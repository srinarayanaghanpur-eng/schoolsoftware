# Implementation Guide - Teacher Attendance & Salary Management System

## System Overview

This is a complete Teacher Attendance and Salary Management System built with:
- **Frontend**: Next.js + React (Web) and React Native (Mobile)
- **Backend**: Firebase (Firestore + Authentication)
- **Business Logic**: Attendance tracking, late deduction, CL management, salary calculation

---

## Key Business Rules

### 1. Attendance Status Determination

```
Official Working Hours: 9:00 AM (configurable)
Grace Period: 10 minutes (configurable)

If checkInTime <= 9:00 AM + grace period (9:10 AM)
  ├─ Status = "present"
  └─ No CL deduction
Else
  ├─ Status = "late"
  ├─ Record lateMinutes
  └─ Increment lateEntriesCount
```

### 2. Late Entry to CL Deduction Flow

```
Event: Teacher marks attendance as "late"

Step 1: Increment lateEntriesCount
  teacherData.lateEntriesCount++ (now = 1, 2, 3, 4, ...)

Step 2: Check for CL deduction threshold
  If lateEntriesCount % 3 == 0 (every 3rd late entry)
    ├─ Deduct 1 CL
    └─ Log transaction: { reason: "excessive_lates", casualLeavesDeducted: 1 }

Step 3: Update CL Balance
  teacherData.casualLeaveBalance -= casualLeavesDeducted

Step 4: Prevent negative balance
  casualLeaveBalance = Math.max(casualLeaveBalance, 0)

Example Timeline:
  1st Late Entry → lateEntriesCount = 1, no CL deduction
  2nd Late Entry → lateEntriesCount = 2, no CL deduction
  3rd Late Entry → lateEntriesCount = 3, deduct 1 CL
  4th Late Entry → lateEntriesCount = 4, no CL deduction
  5th Late Entry → lateEntriesCount = 5, no CL deduction
  6th Late Entry → lateEntriesCount = 6, deduct 1 CL (total 2 CL deducted)
```

### 3. Absence to CL Deduction Flow

```
Event: Teacher marks attendance as "absent" OR admin marks teacher absent

Step 1: Increment absentDaysThisMonth
  teacherData.absentDaysThisMonth++

Step 2: Deduct CL
  deductCL = 1
  teacherData.casualLeaveBalance -= 1

Step 3: Log transaction
  { reason: "absent", casualLeavesDeducted: 1 }

Step 4: Prevent negative balance
  casualLeaveBalance = Math.max(casualLeaveBalance, 0)

Rule: 1 Absent Day = 1 CL Deduction (always)
```

### 4. Casual Leave Balance Management

```
Initial Balance: Set when teacher is created (usually 12 per year or configurable)

Monthly Allocation:
  - At the start of each month, add monthlyAllowance (usually 1 or 2 CLs)
  - Total allocation = initialBalance + (monthlyAllowance × months elapsed)

Deductions:
  - 1 per absent day
  - 1 per 3 late entries (cumulative)

Balance Exhaustion:
  - If balance reaches 0, no further CLs can be deducted
  - Salary deduction is applied instead (per-day-salary × excess days)

Example (assuming 1 CL per month, initial 12):
  Jan 1: Balance = 12
  Jan 15: 3 late entries → Balance = 11
  Jan 20: 1 absent → Balance = 10
  Jan 25: 3 late entries → Balance = 9
  Feb 1: Monthly allowance +1 → Balance = 10
  Feb 10: 2 absent → Balance = 8
  ...

Exhaustion Example:
  Aug: Balance = 0
  Aug 22: 1 absent (no more CLs to deduct)
    ├─ Attendance marked as "absent"
    ├─ CL deduction attempted but balance is 0
    ├─ Instead: perDaySalary is deducted from salary
    └─ Log: { reason: "absent", casualLeavesDeducted: 0, salaryDeducted: perDaySalary }
```

### 5. Salary Calculation Logic

```
Formula: Net Salary = Base Salary - Total Deductions + Bonus

Where Total Deductions = Deduction from Absent + Deduction from Late + 
                        Deduction from Exhausted CL + Manual Deductions

Calculation Steps:

Step 1: Calculate per-day salary
  perDaySalary = baseSalary / totalWorkingDays
  where totalWorkingDays = calendar days - holidays - weekends

  Example: 50,000 / 22 = 2,272.73

Step 2: Deduction from absent days
  deductionFromAbsent = absentDays × perDaySalary

  Example: 2 absent days × 2,272.73 = 4,545.46

Step 3: Deduction from late entries (configurable mode)
  Mode 1: "none"
    deductionFromLates = 0

  Mode 2: "half_day"
    deductionFromLates = lateDays × (perDaySalary × 0.5)
    Example: 1 late day × 1,136.36 = 1,136.36

  Mode 3: "fixed"
    deductionFromLates = lateEntriesCount × fixedAmount
    Example: 5 late entries × 100 = 500

  Mode 4: "after_3_lates_one_day" (DEFAULT)
    fullDaysFromLates = floor(lateEntriesCount / 3)
    deductionFromLates = fullDaysFromLates × perDaySalary
    Example: floor(5 / 3) × 2,272.73 = 1 × 2,272.73 = 2,272.73

Step 4: Deduction from exhausted CL
  If casualLeavesUsedThisMonth > casualLeaveAllowancePerMonth
    excessDays = casualLeavesUsedThisMonth - casualLeaveAllowancePerMonth
    deductionFromExhaustedCL = excessDays × perDaySalary
  Else
    deductionFromExhaustedCL = 0

  Example: If 2 CL used but only 1 allowed
    excessDays = 2 - 1 = 1
    deductionFromExhaustedCL = 1 × 2,272.73 = 2,272.73

Step 5: Calculate total deduction
  totalDeduction = deductionFromAbsent + deductionFromLates + 
                   deductionFromExhaustedCL + manualDeduction

  Example: 4,545.46 + 2,272.73 + 2,272.73 + 0 = 9,090.92

Step 6: Calculate final salary
  netSalary = baseSalary - totalDeduction + bonus
  Example: 50,000 - 9,090.92 + 0 = 40,909.08
```

### 6. Monthly Summary Aggregation

```
At the end of each month, create attendance_summary document:

{
  teacherId: "T001",
  month: "2024-01",
  totalWorkingDays: 22,
  presentDays: 18,          // Count of "present" records
  lateDays: 2,              // Count of "late" records
  absentDays: 2,            // Count of "absent" records
  lateEntriesCount: 5,      // Running total of late entries
  casualLeavesDeductedFromLates: 1,  // floor(5 / 3)
  casualLeavesDeductedFromAbsent: 2, // absentDays
  casualLeavesUsed: 0,      // From leave_requests with status="approved"
  casualLeaveBalanceBefore: 12,
  casualLeaveBalanceAfter: 9,  // 12 - 1 - 2 (late and absent deductions)
}
```

---

## Data Flow Diagrams

### Attendance Marking Flow
```
┌─────────────────────────────────────┐
│ Teacher marks attendance (mobile)   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Validate GPS & Geofence             │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ Compare check-in time vs 9:00 AM    │
└────────────┬────────────────────────┘
             │
        ┌────┴────┐
        │          │
        ▼          ▼
    Before 9:10  After 9:10
        │          │
        ▼          ▼
    "present"    "late"
        │          │
        │          ▼
        │    Increment lateEntriesCount
        │          │
        │          ▼
        │    Check: count % 3 == 0?
        │          │
        │      ┌───┴────┐
        │      │         │
        │      ▼         ▼
        │     Yes        No
        │      │         │
        │      ▼         ▼
        │   Deduct 1   Do nothing
        │      CL
        │      │
        └──────┴─────────┐
                 │
                 ▼
        ┌─────────────────────────────────────┐
        │ Update teacher.casualLeaveBalance   │
        └────────────┬────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────┐
        │ Save attendance record              │
        └────────────┬────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────┐
        │ Update monthly_summary              │
        └────────────┬────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────┐
        │ Log CL transaction (if deducted)    │
        └────────────┬────────────────────────┘
                     │
                     ▼
        ┌─────────────────────────────────────┐
        │ Return success response             │
        └─────────────────────────────────────┘
```

### Salary Calculation Flow
```
┌──────────────────────────────────────┐
│ Trigger: Generate salary for month   │
└────────────┬───────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Fetch teacher: baseSalary            │
└────────────┬───────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Fetch monthly_summary: attendance    │
│ (presentDays, lateDays, absentDays)  │
└────────────┬───────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Calculate perDaySalary               │
│ = baseSalary / totalWorkingDays      │
└────────────┬───────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Calculate deductions:                │
│ ├─ fromAbsent                        │
│ ├─ fromLates (based on mode)         │
│ ├─ fromExhaustedCL                   │
│ └─ totalDeduction = sum              │
└────────────┬───────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Calculate netSalary                  │
│ = baseSalary - totalDeduction + bonus│
└────────────┬───────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Create salary_reports document       │
└────────────┬───────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Return calculated report             │
└──────────────────────────────────────┘
```

---

## Database Transactions

### Atomic Attendance Marking
```typescript
// All operations succeed or all fail (ACID guarantees)
await runTransaction(db, async (transaction) => {
  // 1. Get teacher (locked for this transaction)
  const teacher = await transaction.get(teacherRef);
  
  // 2. Calculate CL deduction
  const clToDeduct = calculateCLDeduction(teacher.lateEntriesCount);
  
  // 3. Update all related documents atomically
  transaction.update(teacherRef, {
    lateEntriesCount: newCount,
    casualLeaveBalance: newBalance,
  });
  
  transaction.set(attendanceRef, attendanceData);
  
  if (clToDeduct > 0) {
    transaction.set(clTransactionRef, clTransactionData);
  }
  
  transaction.update(summaryRef, summaryData);
  
  // If any fails, all roll back
});
```

---

## Firestore Indexes Required

Create these composite indexes for optimal query performance:

```
Collection: attendance
├─ Index 1: (teacherId: Asc, date: Desc)
├─ Index 2: (status: Asc, date: Desc)
└─ Index 3: (month: Asc, date: Desc)

Collection: attendance_summary
├─ Index 1: (month: Desc, createdAt: Desc)
└─ Index 2: (teacherId: Asc, month: Desc)

Collection: casual_leave_transactions
└─ Index 1: (teacherId: Asc, date: Desc)

Collection: salary_reports
├─ Index 1: (month: Desc, status: Asc)
└─ Index 2: (teacherId: Asc, month: Desc)

Collection: leave_requests
├─ Index 1: (teacherId: Asc, status: Asc)
└─ Index 2: (status: Asc, submittedAt: Desc)
```

---

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper functions
    function isAdmin() {
      return request.auth.token.role == 'admin';
    }

    function isTeacher() {
      return request.auth.token.role == 'teacher';
    }

    function isOwner(teacherId) {
      return request.auth.token.teacherId == teacherId;
    }

    // Attendance collection
    match /attendance/{document=**} {
      allow read: if isAdmin() || (isTeacher() && isOwner(resource.data.teacherId));
      allow create: if isTeacher() && isOwner(request.resource.data.teacherId);
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // Teachers collection
    match /teachers/{teacherId} {
      allow read: if isAdmin() || (isTeacher() && isOwner(teacherId));
      allow write: if isAdmin();
    }

    // Salary reports
    match /salary_reports/{document=**} {
      allow read: if isAdmin() || (isTeacher() && isOwner(resource.data.teacherId));
      allow write: if isAdmin();
    }

    // Leave requests
    match /leave_requests/{requestId} {
      allow read: if isAdmin() || (isTeacher() && request.auth.uid == resource.data.submittedBy);
      allow create: if isTeacher() && request.auth.uid == request.resource.data.submittedBy;
      allow update: if isAdmin() || (isTeacher() && request.auth.uid == resource.data.submittedBy);
    }

    // School settings (read-only for all)
    match /school_settings/{document=**} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
    }

    // Audit logs (admin only)
    match /admin_audit_logs/{document=**} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

---

## Environment Configuration

Create `.env.local` in web app:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Backend Configuration
FIREBASE_ADMIN_SDK_KEY=your_admin_key
NEXT_PUBLIC_API_URL=http://localhost:3000

# School Settings
NEXT_PUBLIC_SCHOOL_NAME=Your School Name
NEXT_PUBLIC_SCHOOL_START_TIME=09:00
NEXT_PUBLIC_GRACE_MINUTES=10
NEXT_PUBLIC_GEOFENCE_RADIUS=150
```

---

## Testing the System

### Test Scenario 1: Late Entry to CL Deduction
```
1. Create test teacher with 12 CL balance
2. Mark attendance late on Day 1 → lateEntriesCount = 1
3. Mark attendance late on Day 2 → lateEntriesCount = 2
4. Mark attendance late on Day 3 → lateEntriesCount = 3, CL deducted = 1, balance = 11 ✓
```

### Test Scenario 2: Absent Day Processing
```
1. Create test teacher with 12 CL balance
2. Mark attendance absent on Day 1 → CL deducted = 1, balance = 11 ✓
3. Mark attendance absent on Day 2 → CL deducted = 1, balance = 10 ✓
```

### Test Scenario 3: Salary Calculation
```
1. Teacher: 50,000/month salary, 22 working days
2. Mark: 20 present, 2 late, 0 absent
3. Deduction from lates: floor(2/3) × 2,272.73 = 0
4. Expected net: 50,000 - 0 = 50,000 ✓
```

---

## Monitoring and Debugging

### Key Metrics to Monitor
- Average daily CL balance
- Late entry distribution
- Salary deduction trends
- Attendance accuracy
- System error rates

### Common Issues

**Issue**: CL balance going negative
**Solution**: Ensure `Math.max(balance, 0)` is applied everywhere

**Issue**: Duplicate CL deductions
**Solution**: Check lateEntriesCount increment logic (should only increment once per late entry)

**Issue**: Salary calculations incorrect
**Solution**: Verify totalWorkingDays calculation includes correct holidays

---

## Migration Guide

If migrating from another system:

```
1. Export existing teacher data
2. Validate all required fields present
3. Batch create teachers in Firebase
4. Migrate historical attendance (if needed)
5. Initialize CL balances based on company policy
6. Validate all calculations match old system
7. Run parallel period for validation
8. Go live
```

---

## Performance Optimization

1. **Cache school settings** - Retrieved frequently
2. **Batch operations** - Process salary monthly in batch
3. **Pagination** - Use pagination for large datasets
4. **Indexing** - Create all recommended indexes
5. **Query optimization** - Use field selectors to reduce data transfer

---

## Backup and Recovery

Firestore automatic backups are enabled. For manual backup:

```bash
gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
```

For recovery:
```bash
gcloud firestore import gs://your-bucket/backup-20240101
```

---

## Future Enhancements

1. **Biometric Integration** - Already partially implemented, enable device polling
2. **Mobile App** - Complete React Native implementation
3. **Notifications** - Email/SMS alerts for late attendance
4. **Advanced Analytics** - Dashboards with Recharts
5. **Performance Incentives** - Bonus calculation automation
6. **Leave Balance Carry-forward** - Unused CL carryover logic
