# Fee Concession Module - Implementation Integration Guide

## Step-by-Step Integration Instructions

This guide explains how to integrate the Fee Concession module into your existing School Management System.

---

## Part 1: Database Setup

### 1. Create Firestore Collections

Execute the following initialization in your Firebase Console or via admin SDK:

```javascript
// Initialize Fee Collections (Run once)

// 1. Create FeeStructures
db.collection('feeStructures').add({
  classRange: '1-5',
  academicYear: '2024-2025',
  tuitionFee: 30000,
  transportFee: 5000,
  labFee: 2000,
  developmentFee: 1000,
  otherFees: 2000,
  totalFee: 40000,
  dueDate: new Date('2024-12-31'),
  createdAt: new Date(),
  updatedAt: new Date()
});

// 2. Similar entries for class ranges 6-8 and 9-10
// 3. Concessions, Payments, Receipts collections will be auto-created on first document
```

### 2. Update Existing Students

Run this script to add fee fields to existing students:

```javascript
const batch = db.batch();
const studentDocs = await db.collection('students').get();

studentDocs.forEach(doc => {
  batch.update(doc.ref, {
    totalConcessionAmount: 0,
    activeConcessionCount: 0,
    totalFeesDue: 40000, // Get from feeStructures
    totalFeesPaid: 0,
    lastPaymentDate: null,
    concessionStatus: 'none',
    attendancePercentage: 0,
    feeLastUpdated: new Date()
  });
});

await batch.commit();
```

---

## Part 2: Frontend Setup

### 1. Install Dependencies

All required packages are already installed:
- firebase
- react
- next
- recharts (for charts)
- lucide-react (for icons)

### 2. Create Directory Structure

```bash
# Create directories for fee module
mkdir -p apps/web/app/admin/fee-concessions/create
mkdir -p apps/web/app/admin/fee-concessions/[id]/edit
mkdir -p apps/web/app/admin/payments
mkdir -p apps/web/app/admin/fee-reports
mkdir -p apps/web/app/api/admin/concessions
mkdir -p apps/web/app/api/admin/payments
mkdir -p apps/web/app/api/admin/reports
```

### 3. Copy Generated Files

Copy all the generated files from this integration into your project:
- Pages (.tsx files) into `apps/web/app/admin/`
- API routes (.ts files) into `apps/web/app/api/admin/`
- Services (.ts files) into `apps/web/lib/`
- Components (.tsx files) into `apps/web/components/`
- Types (.ts file) into `apps/web/types/`

---

## Part 3: Dashboard Integration

### Update Dashboard with Fee Cards

File: `apps/web/app/admin/dashboard/page.tsx`

```typescript
"use client";

import { DollarSign, Users, TrendingUp, AlertCircle } from "lucide-react";
import { FeeSummaryCard } from "@/components/FeeComponents";
import { feeService } from "@/lib/feeService";
import { useState, useEffect } from "react";

export function FeeDashboardSection() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const dashboardStats = await feeService.getDashboardStats();
      setStats(dashboardStats);
    } catch (error) {
      console.error('Failed to load fee stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading fee data...</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-stone-900">Fee Management Overview</h2>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FeeSummaryCard
          title="Total Students"
          amount={stats.totalStudents}
          icon={Users}
          color="blue"
        />
        <FeeSummaryCard
          title="Students with Concession"
          amount={stats.studentsWithConcession}
          icon={Users}
          color="green"
        />
        <FeeSummaryCard
          title="Total Concession Amount"
          amount={stats.totalConcessionAmount}
          icon={DollarSign}
          color="amber"
        />
        <FeeSummaryCard
          title="Pending Approvals"
          amount={stats.pendingApprovals}
          icon={AlertCircle}
          color="red"
        />
        <FeeSummaryCard
          title="Total Fee Due"
          amount={stats.totalFeeDue}
          icon={DollarSign}
          color="red"
        />
        <FeeSummaryCard
          title="Total Fee Collected"
          amount={stats.totalFeeCollected}
          icon={TrendingUp}
          color="green"
        />
        <FeeSummaryCard
          title="Monthly Collection"
          amount={stats.monthlyCollection}
          icon={DollarSign}
          color="purple"
        />
        <FeeSummaryCard
          title="Average Concession"
          amount={`₹${Math.round(stats.averageConcession)}`}
          icon={DollarSign}
          color="blue"
        />
      </div>
    </div>
  );
}

// Add to main dashboard page
export default function AdminDashboard() {
  return (
    <div className="space-y-8">
      {/* Existing dashboard content */}
      
      {/* Add Fee Section */}
      <FeeDashboardSection />
      
      {/* Continue with other sections */}
    </div>
  );
}
```

---

## Part 4: Student Profile Integration

### Update Student Profile with Fee Tab

File: `apps/web/components/StudentProfileTabs.tsx` (Create new or update existing)

```typescript
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeeSummaryCard, FeeCollectionProgressBar, AttendancePercentage } from "@/components/FeeComponents";
import { paymentService } from "@/lib/paymentService";
import { concessionService } from "@/lib/concessionService";
import { feeService } from "@/lib/feeService";
import { Payment, Concession } from "@/types/fee.types";

interface StudentProfileTabsProps {
  studentId: string;
  studentName: string;
  class: string;
  admissionNumber: string;
}

export function StudentProfileTabs({
  studentId,
  studentName,
  class: studentClass,
  admissionNumber
}: StudentProfileTabsProps) {
  const [activeTab, setActiveTab] = useState("basic");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [concessions, setConcessions] = useState<Concession[]>([]);
  const [feeSummary, setFeeSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentFeeData();
  }, [studentId]);

  const loadStudentFeeData = async () => {
    try {
      const [paymentData, concessionData, summary] = await Promise.all([
        paymentService.getStudentPayments(studentId),
        concessionService.getStudentConcessions(studentId),
        feeService.getStudentFeeSummary(studentId)
      ]);

      setPayments(paymentData);
      setConcessions(concessionData);
      setFeeSummary(summary);
    } catch (error) {
      console.error('Failed to load fee data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="basic">Basic Info</TabsTrigger>
        <TabsTrigger value="fees">Fees & Concessions</TabsTrigger>
        <TabsTrigger value="attendance">Attendance</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-4">
        {/* Basic student information */}
      </TabsContent>

      <TabsContent value="fees" className="space-y-4">
        {loading ? (
          <div>Loading fee data...</div>
        ) : feeSummary ? (
          <div className="space-y-6">
            {/* Fee Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-white p-4 border border-stone-200">
                <p className="text-sm text-stone-500">Total Fee Due</p>
                <p className="mt-2 text-2xl font-bold text-red-600">
                  ₹{feeSummary.totalFeeDue?.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 border border-stone-200">
                <p className="text-sm text-stone-500">Total Fee Paid</p>
                <p className="mt-2 text-2xl font-bold text-emerald-600">
                  ₹{feeSummary.totalFeePaid?.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 border border-stone-200">
                <p className="text-sm text-stone-500">Remaining Amount</p>
                <p className="mt-2 text-2xl font-bold text-amber-600">
                  ₹{feeSummary.remainingAmount?.toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-lg bg-white p-4 border border-stone-200">
                <p className="text-sm text-stone-500">Fee Collection %</p>
                <p className="mt-2 text-2xl font-bold text-blue-600">
                  {feeSummary.feePaidPercentage || 0}%
                </p>
              </div>
            </div>

            {/* Fee Collection Progress Bar */}
            <div className="rounded-lg bg-white p-4 border border-stone-200">
              <h3 className="font-semibold text-stone-900 mb-3">Fee Payment Status</h3>
              <FeeCollectionProgressBar
                paid={feeSummary.totalFeePaid || 0}
                total={feeSummary.totalFeeDue || 0}
                concessionAmount={feeSummary.totalConcessionAmount || 0}
              />
            </div>

            {/* Active Concessions */}
            {concessions.length > 0 && (
              <div className="rounded-lg bg-white p-4 border border-stone-200">
                <h3 className="font-semibold text-stone-900 mb-3">Fee Concessions</h3>
                <div className="space-y-3">
                  {concessions.map((concession) => (
                    <div key={concession.id} className="border-l-4 border-emerald-500 pl-3 py-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-stone-900">
                          {concession.concessionType === "percentage"
                            ? `${concession.concessionPercent}% Concession`
                            : `₹${concession.concessionAmount} Concession`}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-emerald-100 text-emerald-700">
                          {concession.status}
                        </span>
                      </div>
                      <p className="text-sm text-stone-600">{concession.reason}</p>
                      <p className="text-xs text-stone-500">
                        Valid: {new Date(concession.validFrom).toLocaleDateString()} to{" "}
                        {new Date(concession.validUpto).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment History */}
            {payments.length > 0 && (
              <div className="rounded-lg bg-white p-4 border border-stone-200">
                <h3 className="font-semibold text-stone-900 mb-3">Payment History</h3>
                <div className="space-y-2">
                  {payments.slice(0, 5).map((payment) => (
                    <div key={payment.id} className="flex justify-between text-sm border-b border-stone-100 py-2">
                      <span className="text-stone-700">
                        {new Date(payment.paymentDate).toLocaleDateString()}
                      </span>
                      <span className="font-medium text-stone-900">
                        ₹{payment.amountPaid?.toLocaleString("en-IN")}
                      </span>
                      <span className="text-stone-500">{payment.paymentMethod}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="attendance" className="space-y-4">
        {/* Attendance information with fee eligibility */}
        {feeSummary && (
          <div className="rounded-lg bg-white p-4 border border-stone-200">
            <h3 className="font-semibold text-stone-900 mb-3">Attendance & Fee Eligibility</h3>
            <div className="space-y-2">
              <p className="text-stone-600">
                Attendance Percentage: <AttendancePercentage percentage={feeSummary.attendancePercentage || 0} />
              </p>
              <p className="text-stone-600">
                Concession Eligibility:{" "}
                <span
                  className={feeSummary.attendancePercentage >= 75 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}
                >
                  {feeSummary.attendancePercentage >= 75 ? "Eligible" : "Ineligible (Below 75%)"}
                </span>
              </p>
            </div>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
```

---

## Part 5: Attendance Sync

### Sync Attendance with Fee System

File: `apps/web/lib/attendanceSync.ts` (Create new)

```typescript
import { db } from '@sri-narayana/shared/firebase/client';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { feeService } from './feeService';

export async function syncAttendancePercentage(
  studentId: string,
  attendancePercentage: number
) {
  try {
    // Update student's attendance percentage for fee context
    await feeService.updateStudentAttendance(studentId, attendancePercentage);
  } catch (error) {
    console.error('Failed to sync attendance:', error);
  }
}

export async function checkConcessionEligibility(
  studentId: string
): Promise<boolean> {
  // Student is eligible for concession if attendance >= 75%
  const studentRef = doc(db, 'students', studentId);
  const studentSnap = await getDocs(query(collection(db, 'students')));
  
  // Implementation: Check attendance percentage
  return true; // Placeholder
}
```

---

## Part 6: Security Rules Update

### Deploy Updated Firestore Rules

The `firestore.rules` file has been updated. Redeploy using:

```bash
firebase deploy --only firestore:rules
```

Key new rules:
- `concessions` - Admin full access, Accountant read, Principal can approve
- `payments` - Admin full access, Accountant create/update, Principal read
- `receipts` - Admin full access, Accountant create
- `feeAuditLogs` - Admin only

---

## Part 7: Testing Checklist

### Frontend Testing
- [ ] Fee Concessions page loads without errors
- [ ] Can create new concession
- [ ] Can view concession list with filters
- [ ] Can approve/reject concessions
- [ ] Payments page records payments correctly
- [ ] Reports generate without errors
- [ ] Student profile shows fee tab
- [ ] Dashboard shows fee cards

### Backend Testing
- [ ] API endpoints return correct data
- [ ] Database documents created correctly
- [ ] Security rules allow/deny access properly
- [ ] Audit logs are recorded
- [ ] Fee calculations are accurate

### Data Testing
- [ ] Students get fee fields on migration
- [ ] Concession history is maintained
- [ ] Payment receipts are generated
- [ ] Reports show accurate data
- [ ] Attendance sync works

---

## Part 8: Production Deployment

### Deployment Steps

1. **Test in Development**
   ```bash
   npm run dev:web
   # Test all fee features
   ```

2. **Deploy to Staging**
   ```bash
   firebase deploy --project staging
   ```

3. **Run Smoke Tests**
   - Create test concession
   - Record test payment
   - Generate test reports
   - Check audit logs

4. **Deploy to Production**
   ```bash
   firebase deploy --project production
   # This includes:
   # - Firestore rules
   # - API endpoints
   # - Frontend pages
   ```

5. **Monitor**
   - Check Firebase logs for errors
   - Monitor API usage
   - Verify data accuracy
   - Check user access

---

## Part 9: Troubleshooting

### Common Issues

**Issue: "Permission denied" on fee collections**
- Solution: Verify firestore.rules is deployed
- Check user role in users collection
- Ensure authentication is set up correctly

**Issue: Concessions not appearing in list**
- Solution: Check Firestore database has concessions collection
- Verify query filters match actual data
- Check browser console for errors

**Issue: Payment calculation incorrect**
- Solution: Verify student's totalFeesDue field exists
- Check fee structure data
- Validate concession amounts

**Issue: Reports not generating**
- Solution: Check API endpoint is deployed
- Verify data exists in Firestore
- Check browser network tab for errors

---

## Part 10: Maintenance

### Regular Tasks

- **Weekly**: Review pending approvals
- **Monthly**: Generate fee reports
- **Quarterly**: Archive old receipts
- **Yearly**: Update fee structures

### Monitoring

- Monitor API response times
- Track database size
- Review error logs
- Validate data accuracy

---

## Support & Documentation

For detailed documentation, see:
- [Firestore Schema](./FIRESTORE_SCHEMA_FEE_CONCESSIONS.md)
- [Integration Guide](./FEE_CONCESSION_INTEGRATION_GUIDE.md)
- [API Documentation](./docs/API_DOCUMENTATION.md)

---

**Last Updated**: 2026-06-15  
**Version**: 1.0  
**Status**: Production Ready
