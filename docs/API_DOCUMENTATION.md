# API Documentation - Teacher Attendance & Salary Management System

## Base URL
```
Development: http://localhost:3000/api
Production: https://yourdomain.com/api
```

## Authentication
All endpoints require Bearer token authentication (Firebase ID token).

```bash
Authorization: Bearer <firebase_id_token>
```

---

## Attendance Endpoints

### 1. Mark Attendance
**POST** `/attendance/mark`

Mark daily attendance with GPS validation and automatic late detection.

**Request Body:**
```json
{
  "teacherId": "string",
  "checkInTime": "2024-01-15T08:45:00Z",
  "checkOutTime": "2024-01-15T17:30:00Z",
  "latitude": 18.3062,
  "longitude": 79.8829,
  "source": "mobile"
}
```

**Response (200):**
```json
{
  "success": true,
  "attendanceId": "teacher_123_2024-01-15",
  "status": "present|late|absent",
  "isLate": false,
  "lateMinutes": 0,
  "gpsVerified": true,
  "casualLeaveDeducted": 0,
  "newCLBalance": 12
}
```

**Business Logic:**
- Determines status based on check-in time vs school start time (9:00 AM + grace period)
- Validates GPS location within geofence (150m default)
- Automatically deducts CL every 3 late entries
- Updates teacher's monthly attendance summary

---

### 2. Mark Absent
**POST** `/attendance/mark-absent`

Mark a teacher as absent and automatically deduct 1 CL.

**Request Body:**
```json
{
  "teacherId": "string",
  "date": "2024-01-15",
  "reason": "Medical emergency"
}
```

**Response (200):**
```json
{
  "success": true,
  "attendanceId": "teacher_123_2024-01-15",
  "status": "absent",
  "clDeducted": 1,
  "newCLBalance": 10
}
```

**Business Logic:**
- Automatically deducts 1 CL per absent day
- Updates monthly attendance summary
- Logs CL deduction transaction

---

### 3. Get Monthly Attendance Summary
**GET** `/attendance/summary?teacherId=string&month=YYYY-MM`

Get aggregated attendance statistics for a teacher in a specific month.

**Response (200):**
```json
{
  "success": true,
  "summary": {
    "teacherId": "string",
    "month": "2024-01",
    "totalWorkingDays": 22,
    "presentDays": 20,
    "lateDays": 1,
    "absentDays": 1,
    "lateEntriesCount": 3,
    "casualLeavesDeductedFromLates": 1,
    "casualLeavesDeductedFromAbsent": 1,
    "casualLeavesUsed": 0,
    "casualLeaveBalanceBefore": 12,
    "casualLeaveBalanceAfter": 10
  }
}
```

---

### 4. Get Teacher Attendance Records
**GET** `/attendance/records?teacherId=string&month=YYYY-MM&limit=50`

Retrieve detailed attendance records for a teacher.

**Response (200):**
```json
{
  "success": true,
  "records": [
    {
      "date": "2024-01-15",
      "status": "present",
      "checkInTime": "2024-01-15T08:55:00Z",
      "checkOutTime": "2024-01-15T17:30:00Z",
      "isLate": false,
      "lateMinutes": 0,
      "gpsVerified": true,
      "source": "mobile"
    }
  ]
}
```

---

### 5. Update Attendance (Admin)
**PATCH** `/admin/attendance`

Manually edit attendance record with audit trail.

**Request Body:**
```json
{
  "teacherId": "string",
  "date": "2024-01-15",
  "newStatus": "present|late|absent|cl|holiday",
  "reason": "System error correction"
}
```

**Response (200):**
```json
{
  "success": true,
  "oldStatus": "absent",
  "newStatus": "present",
  "auditLogId": "log_123"
}
```

---

## Salary Management Endpoints

### 1. Generate Salary Report
**POST** `/admin/salary/generate`

Generate monthly salary report for a single teacher.

**Request Body:**
```json
{
  "teacherId": "string",
  "month": "2024-01"
}
```

**Response (200):**
```json
{
  "success": true,
  "reportId": "2024-01_teacher_123",
  "month": "2024-01",
  "teacherName": "John Doe",
  "baseSalary": 50000,
  "totalWorkingDays": 22,
  "perDaySalary": 2272.73,
  "presentDays": 20,
  "lateDays": 1,
  "absentDays": 1,
  "casualLeavesUsed": 0,
  "deductionFromAbsent": 2272.73,
  "deductionFromLates": 0,
  "deductionFromExhaustedCL": 0,
  "totalDeduction": 2272.73,
  "netSalary": 47727.27,
  "status": "calculated"
}
```

---

### 2. Generate Batch Salary Reports
**POST** `/admin/salary/generate-batch`

Generate salary reports for all active teachers in a month.

**Request Body:**
```json
{
  "month": "2024-01"
}
```

**Response (200):**
```json
{
  "success": true,
  "month": "2024-01",
  "totalReportsGenerated": 45,
  "reports": [
    {
      "reportId": "2024-01_teacher_1",
      "teacherName": "John Doe",
      "netSalary": 47727.27,
      "status": "calculated"
    }
  ]
}
```

---

### 3. Get Salary Report
**GET** `/salary/report?reportId=2024-01_teacher_123`

Retrieve a specific salary report.

**Response (200):**
```json
{
  "success": true,
  "report": {
    "reportId": "2024-01_teacher_123",
    "month": "2024-01",
    "teacherName": "John Doe",
    "employeeId": "E001",
    "baseSalary": 50000,
    "perDaySalary": 2272.73,
    "presentDays": 20,
    "lateDays": 1,
    "absentDays": 1,
    "deductionFromAbsent": 2272.73,
    "deductionFromLates": 0,
    "totalDeduction": 2272.73,
    "netSalary": 47727.27,
    "status": "calculated",
    "isApproved": false,
    "isPaid": false
  }
}
```

---

### 4. Approve Salary Report
**PATCH** `/admin/salary/approve`

Approve a calculated salary report.

**Request Body:**
```json
{
  "reportId": "2024-01_teacher_123"
}
```

**Response (200):**
```json
{
  "success": true,
  "reportId": "2024-01_teacher_123",
  "newStatus": "approved",
  "approvedAt": "2024-01-31T10:30:00Z"
}
```

---

### 5. Mark Salary as Paid
**PATCH** `/admin/salary/mark-paid`

Mark salary report as paid.

**Request Body:**
```json
{
  "reportId": "2024-01_teacher_123",
  "paymentMethod": "bank_transfer",
  "paymentReference": "TXN123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "reportId": "2024-01_teacher_123",
  "status": "paid",
  "paidAt": "2024-02-01T14:00:00Z"
}
```

---

### 6. Add Manual Deduction
**PATCH** `/admin/salary/add-deduction`

Add a manual deduction to salary report.

**Request Body:**
```json
{
  "reportId": "2024-01_teacher_123",
  "deductionAmount": 500,
  "reason": "Damage to school property"
}
```

**Response (200):**
```json
{
  "success": true,
  "reportId": "2024-01_teacher_123",
  "deductionAdded": 500,
  "newTotalDeduction": 2772.73,
  "newNetSalary": 47227.27
}
```

---

### 7. Add Bonus
**PATCH** `/admin/salary/add-bonus`

Add bonus to salary report.

**Request Body:**
```json
{
  "reportId": "2024-01_teacher_123",
  "bonusAmount": 2000,
  "reason": "Performance bonus"
}
```

**Response (200):**
```json
{
  "success": true,
  "reportId": "2024-01_teacher_123",
  "bonusAdded": 2000,
  "newNetSalary": 49227.27
}
```

---

## Reports Endpoints

### 1. Daily Attendance Report
**GET** `/reports?type=daily&date=2024-01-15`

Generate daily attendance report for all teachers.

**Response (200):**
```json
{
  "success": true,
  "type": "Daily Attendance Report",
  "date": "2024-01-15",
  "statistics": {
    "totalRecords": 45,
    "presentCount": 43,
    "lateCount": 1,
    "absentCount": 1,
    "clCount": 0,
    "notMarkedCount": 0
  },
  "records": []
}
```

---

### 2. Monthly Attendance Report
**GET** `/reports?type=monthly-attendance&month=2024-01`

Generate comprehensive monthly attendance report.

**Response (200):**
```json
{
  "success": true,
  "type": "Monthly Attendance Report",
  "month": "2024-01",
  "statistics": {
    "totalTeachers": 45,
    "totalPresentDays": 900,
    "totalLateDays": 15,
    "totalAbsentDays": 10,
    "totalNotMarked": 5
  },
  "teacherDetails": []
}
```

---

### 3. Late Attendance Report
**GET** `/reports?type=late-attendance&month=2024-01`

Get detailed late attendance report for a specific month.

**Response (200):**
```json
{
  "success": true,
  "type": "Late Attendance Report",
  "period": "2024-01",
  "totalLateEntries": 15,
  "teacherSummary": [
    {
      "teacherId": "T001",
      "lateDaysCount": 3,
      "averageLateMinutes": "8.3",
      "details": []
    }
  ]
}
```

---

### 4. Leave Deduction Report
**GET** `/reports?type=leave-deduction&month=2024-01`

View all casual leave deductions for the month.

**Response (200):**
```json
{
  "success": true,
  "type": "Leave Deduction Report",
  "month": "2024-01",
  "totalTransactions": 25,
  "teacherSummary": [
    {
      "teacherId": "T001",
      "deductionsFromAbsent": 2,
      "deductionsFromLates": 1,
      "totalDeductions": 3,
      "transactions": []
    }
  ]
}
```

---

### 5. Monthly Salary Report
**GET** `/reports?type=salary&month=2024-01` (Admin only)

Comprehensive salary report for all teachers in a month.

**Response (200):**
```json
{
  "success": true,
  "type": "Monthly Salary Report",
  "month": "2024-01",
  "statistics": {
    "totalTeachers": 45,
    "totalBaseSalary": 2250000,
    "totalDeductions": 102273,
    "totalNetSalary": 2147727,
    "averageNetSalary": 47727
  },
  "teacherDetails": []
}
```

---

### 6. Teacher Attendance Report
**GET** `/reports?type=teacher&teacherId=T001&month=2024-01`

Get personalized attendance report for a teacher.

**Response (200):**
```json
{
  "success": true,
  "type": "Teacher Attendance Report",
  "teacher": {
    "teacherId": "T001",
    "name": "John Doe",
    "employeeId": "E001"
  },
  "period": "2024-01",
  "statistics": {
    "totalRecords": 22,
    "presentCount": 20,
    "lateCount": 1,
    "absentCount": 1,
    "clCount": 0,
    "averageLateMinutes": "10"
  },
  "detailedRecords": []
}
```

---

### 7. Dashboard Statistics
**GET** `/reports?type=dashboard` (Admin only)

Get all dashboard statistics.

**Response (200):**
```json
{
  "success": true,
  "type": "Dashboard Statistics",
  "today": {
    "date": "2024-01-15",
    "totalMarked": 45,
    "present": 43,
    "late": 1,
    "absent": 1,
    "notMarked": 0
  },
  "monthly": {
    "month": "2024-01",
    "totalTeachers": 45,
    "averageAttendance": "95.45",
    "highestLateCount": 5,
    "averageLateCount": "0.33"
  },
  "casualLeave": {
    "averageBalance": "8.5",
    "criticalCount": 2,
    "warningCount": 5
  },
  "totalTeachers": 45
}
```

---

## Export Endpoints

### Export Any Report to CSV
**GET** `/reports?type=<type>&format=csv`

Add `&format=csv` to any report endpoint to download as CSV.

Example:
```
GET /reports?type=daily&date=2024-01-15&format=csv
```

Returns a CSV file download.

---

## Error Responses

### 400 - Bad Request
```json
{
  "error": "Missing required parameter",
  "parameter": "month"
}
```

### 401 - Unauthorized
```json
{
  "error": "Unauthorized access",
  "message": "Valid Firebase token required"
}
```

### 403 - Forbidden
```json
{
  "error": "Forbidden",
  "message": "Admin access required"
}
```

### 404 - Not Found
```json
{
  "error": "Resource not found",
  "resource": "Teacher"
}
```

### 500 - Server Error
```json
{
  "error": "Internal server error",
  "message": "Failed to generate report"
}
```

---

## Rate Limiting

- **Default**: 100 requests per minute per user
- **Batch operations**: 10 requests per minute per user
- **Reports**: 50 requests per minute per user

---

## Pagination

For endpoints returning lists:

```bash
GET /api/attendance/records?teacherId=T001&limit=50&offset=0
```

- `limit`: Number of records per page (default: 50, max: 500)
- `offset`: Number of records to skip (default: 0)

---

## Filtering

### By Date Range
```bash
GET /api/attendance/records?teacherId=T001&startDate=2024-01-01&endDate=2024-01-31
```

### By Status
```bash
GET /api/attendance/records?teacherId=T001&status=late
```

### By Multiple Criteria
```bash
GET /api/reports?type=late-attendance&month=2024-01&minLateMinutes=10
```

---

## Real-time Updates

Some endpoints support WebSocket connections for real-time updates:

```javascript
const ws = new WebSocket('wss://api.yourdomain.com/ws/attendance');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle real-time attendance update
};
```

---

## Best Practices

1. **Always include authentication token** in headers
2. **Validate date formats** (YYYY-MM-DD for dates, YYYY-MM for months)
3. **Use appropriate HTTP methods** (GET for retrieval, POST for creation, PATCH for updates)
4. **Handle errors gracefully** with proper error handling
5. **Cache reports** when possible to reduce API calls
6. **Use pagination** for large datasets
7. **Include timezone information** when dealing with dates

---

## Example Workflows

### Daily Attendance Marking
```
1. GET /school-settings (get school start time, grace period)
2. POST /attendance/mark (with GPS coordinates)
3. If late: System automatically deducts CL every 3 lates
4. GET /attendance/summary (view updated summary)
```

### Monthly Salary Processing
```
1. GET /attendance/summary (for all teachers in month)
2. POST /salary/generate-batch (generate all salary reports)
3. PATCH /salary/approve (approve reports)
4. GET /reports?type=salary (view salary report)
5. PATCH /salary/mark-paid (mark as paid)
```

### Reporting
```
1. GET /reports?type=daily (today's attendance)
2. GET /reports?type=monthly-attendance (monthly summary)
3. GET /reports?type=late-attendance (late analysis)
4. GET /reports?type=leave-deduction (CL deductions)
5. Export to CSV with ?format=csv
```
