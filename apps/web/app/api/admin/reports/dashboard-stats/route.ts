import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

/**
 * GET /api/admin/reports/dashboard-stats
 * Get dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    // Get total students
    const studentsSnapshot = await db.collection('students').get();
    const students = studentsSnapshot.docs.map((d) => d.data());
    const totalStudents = students.length;

    // Get concession stats
    const concessionsSnapshot = await db
      .collection('concessions')
      .where('status', '==', 'approved')
      .where('isActive', '==', true)
      .get();

    const concessions = concessionsSnapshot.docs.map((d) => d.data());
    const studentsWithConcession = new Set(
      concessions.map((c) => c.studentId)
    ).size;

    const totalConcessionAmount = concessions.reduce(
      (sum, c) => sum + (c.concessionAmount || 0),
      0
    );

    const totalFeeAmount = students.reduce(
      (sum, s) => sum + (s.totalFeeAmount || 0),
      0
    );
    const totalFeeDue = students.reduce((sum, s) => sum + (s.totalFeesDue || 0), 0);
    const totalFeeOutstanding = students.reduce(
      (sum, s) => sum + Math.max(0, (s.totalFeesDue || 0) - (s.totalFeesPaid || 0)),
      0
    );
    const studentsWithOutstandingFees = students.filter(
      (s) => Math.max(0, (s.totalFeesDue || 0) - (s.totalFeesPaid || 0)) > 0
    ).length;
    const averageAnnualFee = totalStudents > 0 ? totalFeeAmount / totalStudents : 0;

    const pendingSnapshot = await db
      .collection('concessions')
      .where('status', '==', 'pending')
      .get();

    const pendingApprovals = pendingSnapshot.size;

    // Calculate monthly collection
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const paymentsSnapshot = await db.collection('payments').get();
    const payments = paymentsSnapshot.docs.map((d) => d.data());

    // Total collected reads from the `payments` log (single source of truth that
    // Finance also uses) so dashboards and finance reports always agree.
    const totalFeeCollected = payments.reduce(
      (sum, p) => sum + (Number(p.amountPaid) || 0),
      0
    );

    // `createdAt` may be an ISO string or a Firestore Timestamp — normalize both.
    const toDate = (v: unknown): Date | null => {
      if (!v) return null;
      if (typeof v === 'string') return new Date(v);
      if (typeof (v as { toDate?: () => Date }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
      return null;
    };

    const monthlyCollection = payments.reduce((sum, p) => {
      const paymentDate = toDate(p.createdAt ?? p.paymentDate ?? p.date);
      if (!paymentDate || paymentDate < monthStart || paymentDate > monthEnd) return sum;
      return sum + (Number(p.amountPaid) || 0);
    }, 0);

    const averageConcession =
      studentsWithConcession > 0
        ? (totalConcessionAmount / studentsWithConcession).toFixed(2)
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalStudents,
        totalFeeAmount,
        totalFeeDue,
        totalFeeCollected,
        totalFeeOutstanding,
        studentsWithOutstandingFees,
        averageAnnualFee,
        // Legacy concession metrics preserved for backward compatibility
        studentsWithConcession,
        totalConcessionAmount,
        pendingApprovals,
        monthlyCollection,
        averageConcession
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
