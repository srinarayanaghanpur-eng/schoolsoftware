# Implementation Checklist & Quick Start Guide

## Phase 1: Setup & Configuration (Week 1)

### 1.1 Environment Setup
- [ ] Clone repository
- [ ] Install dependencies: `npm install` (root and all packages)
- [ ] Set up `.env.local` with Firebase credentials
- [ ] Configure school settings in `school_settings` collection
- [ ] Create Firestore indexes (see IMPLEMENTATION_GUIDE.md)

### 1.2 Database Initialization
- [ ] Create Firestore collections
- [ ] Add sample data for testing
- [ ] Set up security rules
- [ ] Enable Firestore backups
- [ ] Test database connectivity

### 1.3 Authentication
- [ ] Configure Firebase Auth
- [ ] Set up custom claims (role, teacherId, employeeId)
- [ ] Create admin user account
- [ ] Create test teacher accounts
- [ ] Test role-based access

---

## Phase 2: Core Features Implementation (Week 2-3)

### 2.1 Attendance Marking
- [ ] Implement `EnhancedAttendanceService`
- [ ] Test GPS validation and geofencing
- [ ] Test late detection logic
- [ ] Test CL deduction (every 3 lates)
- [ ] Test duplicate prevention
- [ ] Create attendance marking UI (web)
- [ ] Test attendance marking (mobile)

### 2.2 Leave Management
- [ ] Implement leave request creation
- [ ] Implement leave approval workflow
- [ ] Test automatic attendance update on approval
- [ ] Test CL deduction from leave usage
- [ ] Create leave management UI

### 2.3 Casual Leave Tracking
- [ ] Implement CL balance updates
- [ ] Test deduction from absences (1 CL per day)
- [ ] Test deduction from lates (1 CL per 3 lates)
- [ ] Test CL exhaustion scenario
- [ ] Implement CL transaction logging
- [ ] Create CL balance display UI

---

## Phase 3: Salary Calculation (Week 4)

### 3.1 Salary Service
- [ ] Implement `EnhancedSalaryService`
- [ ] Test per-day salary calculation
- [ ] Test deduction from absences
- [ ] Test deduction from lates (all modes)
- [ ] Test deduction from exhausted CL
- [ ] Test final salary calculation
- [ ] Test batch salary generation

### 3.2 Salary Reports
- [ ] Create salary report generation
- [ ] Test report accuracy
- [ ] Implement salary approval workflow
- [ ] Implement payment marking
- [ ] Add manual deduction feature
- [ ] Add bonus feature
- [ ] Create salary report UI

### 3.3 Salary Management
- [ ] Implement monthly salary processing
- [ ] Create salary dashboard
- [ ] Add export to CSV functionality
- [ ] Add PDF generation

---

## Phase 4: Reporting (Week 5)

### 4.1 Report Generation
- [ ] Implement `ReportService`
- [ ] Daily attendance report
- [ ] Monthly attendance report
- [ ] Late attendance report
- [ ] Leave deduction report
- [ ] Salary report
- [ ] Teacher-specific report
- [ ] Dashboard statistics

### 4.2 Report Features
- [ ] Export to CSV
- [ ] Export to PDF
- [ ] Email report functionality
- [ ] Schedule report generation
- [ ] Report archival

### 4.3 Report UI
- [ ] Create report dashboard
- [ ] Implement report filters
- [ ] Add date range selection
- [ ] Create report viewer
- [ ] Add export buttons

---

## Phase 5: Admin Dashboard (Week 6)

### 5.1 Dashboard Components
- [ ] Overview cards (total teachers, present, late, absent)
- [ ] Attendance trend charts
- [ ] CL balance status display
- [ ] Late attendance report table
- [ ] Salary summary
- [ ] Teacher management table
- [ ] Leave requests table

### 5.2 Dashboard Features
- [ ] Real-time data updates
- [ ] Date range filters
- [ ] Teacher search/filter
- [ ] Bulk actions
- [ ] Data export
- [ ] Print functionality

### 5.3 Admin Actions
- [ ] Manual attendance marking
- [ ] Attendance editing with audit trail
- [ ] CL manual adjustment
- [ ] Salary adjustments
- [ ] Leave approval/rejection
- [ ] Holiday management

---

## Phase 6: Testing & QA (Week 7)

### 6.1 Unit Tests
- [ ] Test attendance logic
- [ ] Test late calculation
- [ ] Test CL deduction logic
- [ ] Test salary calculation
- [ ] Test report generation
- [ ] Validate edge cases

### 6.2 Integration Tests
- [ ] Test end-to-end attendance flow
- [ ] Test salary processing flow
- [ ] Test leave workflow
- [ ] Test database transactions
- [ ] Test API endpoints

### 6.3 System Tests
- [ ] Load testing
- [ ] Performance testing
- [ ] Security testing
- [ ] Backup/recovery testing
- [ ] User acceptance testing

---

## Phase 7: Deployment & Training (Week 8)

### 7.1 Production Setup
- [ ] Set up production Firebase project
- [ ] Configure production environment variables
- [ ] Deploy web app to hosting
- [ ] Set up mobile app distribution
- [ ] Configure backups
- [ ] Set up monitoring and logging

### 7.2 Data Migration
- [ ] Export existing teacher data
- [ ] Validate data format
- [ ] Batch import to Firestore
- [ ] Verify data integrity
- [ ] Run parallel period

### 7.3 Training
- [ ] Admin training
- [ ] Teacher training
- [ ] User documentation
- [ ] Support setup
- [ ] Go-live checklist

---

## Quick Start: 30-Minute Setup

### Step 1: Initialize Firebase (5 min)
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init firestore
```

### Step 2: Create Collections (5 min)
```bash
# Create these collections manually in Firebase Console:
- users
- teachers
- attendance
- attendance_summary
- leave_requests
- salary_reports
- school_settings
- casual_leave_transactions
- holidays
```

### Step 3: Add School Settings (5 min)
```javascript
// Add to school_settings collection
{
  settingId: "default",
  schoolName: "Your School",
  schoolStartTime: "09:00",
  graceMinutesForLate: 10,
  geofenceRadiusMeters: 150,
  campusLatitude: 18.3062,
  campusLongitude: 79.8829,
  defaultLateDeductionMode: "after_3_lates_one_day",
  latesBeforeCLDeduction: 3,
  casualLeaveAllowancePerMonth: 1,
  totalWorkingDaysPerMonth: 22,
  timezone: "Asia/Kolkata"
}
```

### Step 4: Test Attendance Flow (10 min)
```javascript
// Test marking attendance
const result = await enhancedAttendanceService.markAttendance(
  'teacher_001',
  new Date('2024-01-15T08:55:00'),
  new Date('2024-01-15T17:30:00'),
  18.3062,
  79.8829,
  'mobile'
);

console.log(result);
// Expected: { success: true, status: "present", ... }
```

### Step 5: Test Salary Calculation (5 min)
```javascript
// Generate salary report
const report = await enhancedSalaryService.generateSalaryReport(
  'teacher_001',
  '2024-01',
  50000
);

console.log(report);
// Expected: { reportId, baseSalary, netSalary, ... }
```

---

## Testing Scenarios

### Test Scenario 1: Late Entry CL Deduction
**Expected behavior**: Every 3 late entries = 1 CL deduction

```
Day 1: Mark late → lateEntriesCount = 1, CL balance = 12
Day 2: Mark late → lateEntriesCount = 2, CL balance = 12
Day 3: Mark late → lateEntriesCount = 3, CL balance = 11 ✓
Day 4: Mark late → lateEntriesCount = 4, CL balance = 11
Day 5: Mark late → lateEntriesCount = 5, CL balance = 11
Day 6: Mark late → lateEntriesCount = 6, CL balance = 10 ✓
```

**Verification**:
```bash
GET /api/attendance/summary?teacherId=teacher_001&month=2024-01
Expected: { casualLeavesDeductedFromLates: 2, ... }
```

### Test Scenario 2: Absence CL Deduction
**Expected behavior**: Each absent day = 1 CL deduction

```
Day 1: Mark absent → CL deducted = 1, balance = 11
Day 2: Mark absent → CL deducted = 1, balance = 10
Day 3: Mark absent → CL deducted = 1, balance = 9
```

**Verification**:
```bash
GET /api/attendance/summary?teacherId=teacher_001&month=2024-01
Expected: { absentDays: 3, casualLeavesDeductedFromAbsent: 3, casualLeaveBalanceAfter: 9 }
```

### Test Scenario 3: Salary Calculation
**Setup**: 
- Base salary: ₹50,000
- Working days: 22
- Present: 20 days, Late: 1 day, Absent: 1 day

**Expected calculation**:
```
Per-day salary = 50,000 / 22 = ₹2,272.73

Deduction from absent = 1 × 2,272.73 = ₹2,272.73
Deduction from lates = 0 (only 1 late, need 3 for 1 full day deduction)
Total deduction = ₹2,272.73

Net salary = 50,000 - 2,272.73 = ₹47,727.27
```

**Verification**:
```bash
GET /api/salary/report?reportId=2024-01_teacher_001
Expected: { netSalary: 47727.27, deductionFromAbsent: 2272.73, ... }
```

### Test Scenario 4: CL Exhaustion
**Setup**: CL balance = 0

```
Day 1: Mark absent
Expected: 
  - Status = "absent"
  - CL deducted = 0 (balance was 0)
  - Salary deduction = ₹2,272.73
  - Log: { reason: "absent", casualLeavesDeducted: 0, salaryDeducted: 2272.73 }
```

---

## Troubleshooting

### Issue: CL balance going negative
**Cause**: Not applying `Math.max(balance, 0)` after deduction
**Fix**: Check `LateAndLeaveLogic.updateCLBalance()` implementation

### Issue: Duplicate CL deductions
**Cause**: lateEntriesCount being incremented multiple times for same entry
**Fix**: Verify attendance marking is idempotent (duplicate prevention)

### Issue: Salary calculations incorrect
**Cause**: Wrong totalWorkingDays or incorrect late deduction mode
**Fix**: Verify school settings and date calculations

### Issue: Transactions failing
**Cause**: Document structure not matching expected schema
**Fix**: Validate document structure in Firestore

---

## Performance Optimization Tips

1. **Cache school settings** in memory (refreshed every hour)
2. **Use pagination** for large datasets (limit: 50, offset: 0)
3. **Batch operations** for monthly salary processing
4. **Index optimization** - Create all recommended indexes
5. **Query optimization** - Use field selectors to reduce bandwidth

---

## Security Best Practices

1. ✓ All endpoints require Firebase authentication
2. ✓ Role-based access control (admin vs teacher)
3. ✓ Data validation on all inputs
4. ✓ Firestore security rules in place
5. ✓ Audit trails for all modifications
6. ✓ HTTPS only for production
7. ✓ Rate limiting on API endpoints
8. ✓ Input sanitization for all fields

---

## Monitoring Dashboard

Monitor these KPIs:

- **Attendance**: Daily submission rate, on-time percentage, late percentage
- **Leave**: CL balance trends, deduction rate, exhaustion rate
- **Salary**: Deduction trends, payment success rate, processing time
- **System**: API response time, error rate, database performance

---

## Support & Escalation

### Level 1 Support (School Admin)
- View dashboards
- Mark/edit attendance
- Approve/reject leaves
- Process salary

### Level 2 Support (IT Team)
- Troubleshoot user issues
- Manage user accounts
- Monitor system health
- Handle backups

### Level 3 Support (Development)
- Bug fixes
- Performance optimization
- Feature enhancements
- Data migrations

---

## Go-Live Checklist

- [ ] All tests passing
- [ ] Production Firebase project configured
- [ ] Environment variables set correctly
- [ ] Backups configured and tested
- [ ] Monitoring and logging set up
- [ ] Admin trained on all features
- [ ] Teachers trained on attendance marking
- [ ] Data migration completed and verified
- [ ] Security audit completed
- [ ] Documentation ready
- [ ] Support team ready
- [ ] Rollback plan prepared

---

## Post-Launch Support (Week 1-4)

- [ ] Daily monitoring of system health
- [ ] User issue tracking and resolution
- [ ] Performance monitoring
- [ ] Bug fix deployment as needed
- [ ] User feedback collection
- [ ] Continuous optimization

---

## Next Steps After Launch

1. **Week 2**: Collect user feedback and fix critical issues
2. **Week 3**: Optimize performance based on actual usage
3. **Week 4**: Integrate additional features (notifications, advanced analytics)
4. **Month 2**: Mobile app enhancements
5. **Month 3**: Advanced reporting and analytics

---

## Resources

- **API Documentation**: [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **Database Schema**: [COMPLETE_SCHEMA.md](COMPLETE_SCHEMA.md)
- **Implementation Guide**: [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- **Business Logic**: [packages/shared/src/services/businessLogic.ts](../packages/shared/src/services/businessLogic.ts)

---

## Contact & Support

For questions or issues:
1. Check documentation first
2. Review implementation guide
3. Check error logs
4. Contact support team
