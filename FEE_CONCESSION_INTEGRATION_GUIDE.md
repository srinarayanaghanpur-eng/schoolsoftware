# Fee Concession Management Module - Integration Guide

## 📋 Overview
This document provides a complete integration guide for merging the Fee Concession Management Module into the existing School Management System (Next.js + Firebase).

## 🗂️ Project Structure
```
apps/web/
├── app/
│   ├── admin/
│   │   ├── fee-concessions/          [NEW]
│   │   │   ├── page.tsx              [NEW] - List concessions
│   │   │   ├── create/page.tsx       [NEW] - Create new concession
│   │   │   ├── [id]/
│   │   │   │   ├── page.tsx          [NEW] - View concession details
│   │   │   │   └── edit/page.tsx     [NEW] - Edit concession
│   │   ├── payments/                 [NEW]
│   │   │   └── page.tsx              [NEW] - Manage payments
│   │   ├── reports/                  [NEW]
│   │   │   ├── page.tsx              [NEW] - Reports dashboard
│   │   │   ├── class-wise/page.tsx   [NEW]
│   │   │   ├── student-wise/page.tsx [NEW]
│   │   │   └── attendance-fee/page.tsx [NEW]
│   │   └── api/                      [NEW]
│   │       ├── concessions/
│   │       │   ├── route.ts          [NEW]
│   │       │   └── [id]/route.ts     [NEW]
│   │       ├── payments/route.ts     [NEW]
│   │       ├── receipts/route.ts     [NEW]
│   │       └── reports/
│   │           ├── class-wise/route.ts    [NEW]
│   │           ├── student-wise/route.ts  [NEW]
│   │           └── attendance-fee/route.ts [NEW]
├── components/
│   ├── FeeComponents.tsx             [NEW] - Reusable fee components
│   └── StudentProfileTabs.tsx        [UPDATED] - Add fee tab
├── lib/
│   ├── feeService.ts                 [NEW] - Fee business logic
│   ├── concessionService.ts          [NEW] - Concession operations
│   ├── paymentService.ts             [NEW] - Payment operations
│   └── reportService.ts              [NEW] - Report generation
└── types/
    └── fee.types.ts                  [NEW] - Fee-related types
```

## 🗄️ Firestore Schema Updates

### New Collections

#### 1. **concessions** collection
```javascript
{
  id: string (auto-generated),
  studentId: string,
  admissionNumber: string,
  studentName: string,
  class: string,
  section: string,
  parentName: string,
  parentMobile: string,
  concessionType: enum ['percentage', 'fixed'],
  concessionAmount: number,
  concessionPercent: number,
  reason: string,
  attachments: string[], // URLs
  status: enum ['pending', 'approved', 'rejected'],
  approvedBy: string, // admin/principal UID
  approvalDate: Timestamp,
  approvalNotes: string,
  validFrom: Timestamp,
  validUpto: Timestamp,
  isActive: boolean,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  history: [{
    action: string,
    changedBy: string,
    changedAt: Timestamp,
    oldData: object,
    newData: object
  }]
}
```

#### 2. **feeStructures** collection
```javascript
{
  id: string,
  classRange: string, // "1-5", "6-8", "9-10"
  academicYear: string,
  tuitionFee: number,
  transportFee: number,
  labFee: number,
  developmentFee: number,
  otherFees: number,
  totalFee: number,
  dueDate: Timestamp,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 3. **payments** collection
```javascript
{
  id: string,
  studentId: string,
  admissionNumber: string,
  studentName: string,
  amountDue: number,
  amountPaid: number,
  remainingAmount: number,
  concessionApplied: boolean,
  concessionId: string, // Reference to concessions
  paymentDate: Timestamp,
  paymentMethod: enum ['cash', 'cheque', 'online', 'transfer'],
  transactionId: string,
  receiptNumber: string,
  remarks: string,
  recordedBy: string, // admin UID
  status: enum ['pending', 'completed'],
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### 4. **receipts** collection
```javascript
{
  id: string,
  receiptNumber: string,
  paymentId: string,
  studentId: string,
  admissionNumber: string,
  studentName: string,
  class: string,
  section: string,
  amountPaid: number,
  paymentDate: Timestamp,
  receiptDate: Timestamp,
  issuedBy: string,
  pdfUrl: string,
  status: enum ['draft', 'issued', 'cancelled'],
  createdAt: Timestamp
}
```

#### 5. **students** collection (UPDATED)
Add these fields to existing students collection:
```javascript
{
  // ... existing fields ...
  totalConcessionAmount: number, // Running total
  activeConcessionCount: number,
  totalFeesDue: number,
  totalFeesPaid: number,
  lastPaymentDate: Timestamp,
  concessionStatus: enum ['none', 'pending', 'approved', 'rejected'],
  attendancePercentage: number, // From attendance collection
  feeLastUpdated: Timestamp
}
```

## 🔐 Firebase Security Rules

### Updated Security Rules
See: firestore.rules (updated)

Key changes:
- Add concessions collection rules (admin full access, accountant read/write for fees)
- Add payments collection rules
- Add receipts collection rules
- Add role-based access control (admin, accountant, principal)

## 🎨 UI Design Details

### Color Scheme (Matching existing app)
- Primary: #233128 (Dark green - sidebar)
- Accent: #059669 (Emerald)
- Secondary: #0284C7 (Blue)
- Background: #f4f7f3 (Light green)
- Text Primary: Stone-900
- Text Secondary: Stone-500

### Components to Create
1. **FeeCard** - Display fee summary
2. **ConcessionForm** - Form for granting concessions
3. **PaymentRecorder** - Record payments
4. **ReportGenerator** - Generate reports
5. **AttendanceIndicator** - Show attendance % in fee context

## 📊 Dashboard Integration

### New Cards
1. **Total Students** - Count of all students
2. **Students with Active Concessions** - Count
3. **Total Concession Amount** - Sum of approved concessions
4. **Total Fee Due** - Sum of pending fees
5. **Total Fee Collected** - Sum of paid fees
6. **Concession Approval Pending** - Count of pending approvals

### Charts
- Fee Collection Trend (Line chart)
- Concession Distribution by Type (Pie chart)
- Class-wise Fee Status (Bar chart)
- Payment Status (Pie chart)

## 📋 Reports to Generate

1. **Class Wise Concession Report**
   - Class, Section
   - Number of students
   - Students with concessions
   - Total concession amount
   - Average concession

2. **Student Wise Report**
   - Student name, admission number, class
   - Concession details
   - Fee status
   - Payment history
   - Approval status

3. **Attendance vs Fee Concession Report**
   - Student name, admission number
   - Attendance percentage
   - Concession amount
   - Fee due/paid
   - Status

All reports should support:
- Export to PDF
- Export to Excel
- Date range filtering
- Class/Section filtering
- Status filtering

## 🔄 Integration Points

### 1. Student Profile Integration
- Add "Fee & Concession" tab to existing student profile
- Display:
  - Active concessions
  - Fee due/paid
  - Payment history
  - Attendance integration
  - Concession history

### 2. Attendance Integration
- Link attendance data with fee concession filters
- Show attendance % in concession lists
- Create attendance-based concession eligibility report

### 3. Dashboard Integration
- Add fee concession section to admin dashboard
- Show key metrics and charts
- Quick action buttons (Grant Concession, Record Payment)

## 🔐 Access Control

### Role-based Access
```
Admin:
  - Full access to all fee management features
  - Can approve/reject concessions
  - Can generate all reports

Accountant: (new role - optional)
  - Can record payments
  - Can view concessions
  - Can generate reports
  - Cannot approve concessions

Principal: (existing role - update)
  - Can approve concessions
  - Can view all reports
  - Read-only access

Teacher:
  - View student fee status (read-only)
  - Cannot modify any data
```

## 📦 Dependencies

No new external dependencies needed. Uses existing:
- Firebase SDK
- React/Next.js
- Tailwind CSS
- recharts (for charts)
- lucide-react (for icons)

## ✅ Implementation Checklist

- [ ] 1. Update Firestore schema and rules
- [ ] 2. Create API routes
- [ ] 3. Create service layer
- [ ] 4. Create components
- [ ] 5. Create pages
- [ ] 6. Update sidebar navigation
- [ ] 7. Update dashboard
- [ ] 8. Update student profile
- [ ] 9. Create reports functionality
- [ ] 10. Testing and validation
- [ ] 11. Deployment

## 🚀 Deployment Steps

1. Update Firestore rules in Firebase Console
2. Deploy backend (API routes)
3. Deploy frontend (pages and components)
4. Run data migration if needed
5. Test all features
6. Update sidebar in production
7. Monitor and validate

## 📝 Notes

- All timestamps use Firebase Timestamp format
- Student ID is consistent across collections
- Approval workflow supports multiple levels (if needed)
- All changes are audit-logged
- Maintains existing authentication system
- Compatible with existing mobile app structure

---

**Last Updated**: 2026-06-15
**Version**: 1.0
**Status**: Ready for Implementation
