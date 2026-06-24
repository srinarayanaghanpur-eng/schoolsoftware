# Firestore Schema Updates for Fee Concession Module

## Database Collections

### 1. `concessions` Collection (NEW)

**Path:** `/concessions/{concessionId}`

**Document Structure:**
```javascript
{
  // Student Reference
  studentId: string,                          // Reference to students collection
  admissionNumber: string,                    // For quick lookup
  studentName: string,                        // Denormalized for display
  class: string,                              // e.g., "10-A"
  section: string,
  parentName: string,
  parentMobile: string,

  // Concession Details
  concessionType: 'percentage' | 'fixed',    // Type of concession
  concessionAmount: number,                   // Fixed amount (if type='fixed')
  concessionPercent: number,                  // Percentage (if type='percentage')
  reason: string,                             // Reason for concession
  attachments: string[],                      // Array of file URLs (if any)

  // Workflow
  status: 'pending' | 'approved' | 'rejected',
  approvedBy: string,                         // UID of approver
  approvalDate: Timestamp,
  approvalNotes: string,

  // Validity
  validFrom: Timestamp,                       // Concession start date
  validUpto: Timestamp,                       // Concession end date
  isActive: boolean,                          // Current status flag

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp,
  history: Array<{
    action: string,                           // 'created', 'approved', 'updated', etc.
    changedBy: string,                        // UID
    changedAt: Timestamp,
    oldData: object,                          // Previous values
    newData: object                           // New values
  }>
}
```

**Indexes:** Recommended
- `studentId` + `status` + `isActive`
- `status` + `createdAt` (desc)
- `class` + `status`

---

### 2. `feeStructures` Collection (NEW)

**Path:** `/feeStructures/{structureId}`

**Document Structure:**
```javascript
{
  classRange: string,                         // e.g., "1-5", "6-8", "9-10"
  academicYear: string,                       // e.g., "2024-2025"

  // Fee Components
  tuitionFee: number,
  transportFee: number,
  labFee: number,
  developmentFee: number,
  otherFees: number,
  totalFee: number,                           // Sum of all fees

  // Important Dates
  dueDate: Timestamp,

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Indexes:** None (small collection)

---

### 3. `payments` Collection (NEW)

**Path:** `/payments/{paymentId}`

**Document Structure:**
```javascript
{
  // Student Reference
  studentId: string,
  admissionNumber: string,
  studentName: string,

  // Payment Details
  amountDue: number,                          // Original fee amount
  amountPaid: number,                         // Actual payment received
  remainingAmount: number,                    // amountDue - amountPaid

  // Concession Link
  concessionApplied: boolean,
  concessionId: string,                       // Reference to concessions collection
  concessionAmount: number,                   // Concession applied amount (for audit)

  // Payment Info
  paymentDate: Timestamp,
  paymentMethod: 'cash' | 'cheque' | 'online' | 'transfer',
  transactionId: string,                      // For online payments
  receiptNumber: string,

  // Metadata
  remarks: string,                            // Optional notes
  recordedBy: string,                         // UID of person recording payment
  status: 'pending' | 'completed',

  // Audit
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

**Indexes:** Recommended
- `studentId` + `createdAt` (desc)
- `status` + `createdAt` (desc)
- `paymentDate` + `status`

---

### 4. `receipts` Collection (NEW)

**Path:** `/receipts/{receiptId}`

**Document Structure:**
```javascript
{
  // Receipt Tracking
  receiptNumber: string,                      // Unique receipt ID (formatted)
  paymentId: string,                          // Reference to payments

  // Student Details
  studentId: string,
  admissionNumber: string,
  studentName: string,
  class: string,
  section: string,

  // Payment Summary
  amountPaid: number,
  paymentDate: Timestamp,
  receiptDate: Timestamp,

  // Issuance
  issuedBy: string,                           // UID of person issuing receipt
  pdfUrl: string,                             // PDF file URL in storage

  // Status
  status: 'draft' | 'issued' | 'cancelled',

  // Audit
  createdAt: Timestamp
}
```

**Indexes:** Recommended
- `studentId` + `receiptDate` (desc)
- `receiptNumber` (unique index if possible)

---

### 5. `students` Collection (UPDATED)

Add the following fields to existing student documents:

```javascript
{
  // ... existing fields ...
  
  // New Fee Fields
  totalConcessionAmount: number,              // Running total of all concessions
  activeConcessionCount: number,              // Count of active concessions
  totalFeesDue: number,                       // Total fee amount
  totalFeesPaid: number,                      // Total paid amount
  lastPaymentDate: Timestamp,                 // Date of last payment
  concessionStatus: 'none' | 'pending' | 'approved' | 'rejected',  // Current status
  attendancePercentage: number,               // Updated from attendance collection
  feeLastUpdated: Timestamp                   // When fee data was last updated
}
```

---

### 6. `feeAuditLogs` Collection (NEW)

**Path:** `/feeAuditLogs/{auditId}`

**Document Structure:**
```javascript
{
  action: string,                             // 'concession_created', 'payment_recorded', etc.
  entityType: string,                         // 'concession', 'payment', 'receipt'
  entityId: string,                           // Reference ID
  studentId: string,
  changes: {
    oldData: object,
    newData: object
  },
  userId: string,                             // Who performed the action
  ipAddress: string,                          // Optional: track access
  timestamp: Timestamp
}
```

---

## Collection Relationships

```
students
├── concessions (studentId)
│   ├── history (audit trail)
│   └── approvals (by principal/admin)
└── payments (studentId)
    ├── concessions (concessionId reference)
    └── receipts (paymentId reference)
```

---

## Field Constraints & Validation

### Concessions
- `concessionPercent` must be 0-100 if `concessionType` = 'percentage'
- `concessionAmount` must be > 0
- `validFrom` must be before `validUpto`
- `reason` minimum length: 10 characters
- `status` workflow: pending → approved/rejected (only one time)

### Payments
- `amountPaid` must be > 0
- `amountPaid` should not exceed `amountDue` (unless overpayment is allowed)
- `remainingAmount` = `amountDue` - `amountPaid`
- `paymentDate` cannot be in the future
- `transactionId` is required if `paymentMethod` = 'online'

### Receipts
- `receiptNumber` must be unique (enforce with composite key)
- `status` workflow: draft → issued → (no further changes except cancel)
- `status` = 'cancelled' is irreversible

---

## Migration Script

To add fee fields to existing students:

```javascript
// Run this once during deployment
db.collection('students').get().then(snapshot => {
  snapshot.forEach(doc => {
    doc.ref.update({
      totalConcessionAmount: 0,
      activeConcessionCount: 0,
      totalFeesDue: 0,
      totalFeesPaid: 0,
      lastPaymentDate: null,
      concessionStatus: 'none',
      attendancePercentage: 0,
      feeLastUpdated: firebase.firestore.Timestamp.now()
    });
  });
});
```

---

## Performance Optimizations

### Denormalization
- Store `studentName`, `class`, `section` in concessions/payments to avoid repeated lookups
- Store denormalized data in receipts for fast PDF generation
- Update denormalized fields when student details change

### Indexes
- Create composite indexes for common queries (see above)
- Use `/` for doc IDs (auto-generated by Firebase) for better distribution

### Batch Operations
- Use batch writes for related operations (e.g., create concession + update student)
- Limit batch size to Firebase limits (500 writes/operation)

---

## Backups & Archives

- Archive old receipts to separate collection after 1 year
- Archive completed payments to audit collection
- Maintain audit trail for compliance (min. 7 years)

---

**Version:** 1.0  
**Last Updated:** 2026-06-15
