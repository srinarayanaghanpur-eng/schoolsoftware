import { NextRequest, NextResponse } from 'next/server';
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreAggregateRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/dashboard-stats
 * Get dashboard statistics
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      studentsCountSnap,
      feeTotalsSnap,
      studentsWithOutstandingSnap,
      concessionsSnap,
      pendingConcessionsSnap,
      feeCollectedSnap,
      monthlyCollectionSnap
    ] = await Promise.all([
      db.collection("students").count().get(),
      db.collection("studentFeeSummaries").aggregate({
        totalFeeAmount: AggregateField.sum("totalFee"),
        totalFeeDue: AggregateField.sum("dueAmount"),
        totalPaid: AggregateField.sum("totalPaid")
      }).get().catch(() => null),
      db.collection("studentFeeSummaries").where("dueAmount", ">", 0).count().get().catch(() => null),
      db.collection("concessions").where("status", "==", "approved").where("isActive", "==", true).aggregate({
        studentsWithConcession: AggregateField.count(),
        totalConcessionAmount: AggregateField.sum("concessionAmount")
      }).get().catch(() => null),
      db.collection("concessions").where("status", "==", "pending").count().get(),
      db.collection("financeSummaries").aggregate({
        totalFeeCollected: AggregateField.sum("totalIncome")
      }).get().catch(() => null),
      db.collection("payments")
        .where("status", "==", "completed")
        .where("createdAt", ">=", monthStart)
        .where("createdAt", "<=", monthEnd)
        .aggregate({ monthlyCollection: AggregateField.sum("amountPaid") })
        .get()
        .catch(() => null)
    ]);

    logFirestoreAggregateRead("DashboardStatsAPI", "students", { operation: "count" });
    logFirestoreAggregateRead("DashboardStatsAPI", "studentFeeSummaries", { operation: "sum-total-due-paid" });
    logFirestoreAggregateRead("DashboardStatsAPI", "payments", { operation: "monthly-sum" });

    const totalStudents = Number(studentsCountSnap.data().count || 0);
    const feeTotals = (feeTotalsSnap?.data() ?? {}) as Record<string, unknown>;
    const concessionTotals = (concessionsSnap?.data() ?? {}) as Record<string, unknown>;
    const totalFeeAmount = Number(feeTotals.totalFeeAmount || 0);
    const totalFeeDue = Number(feeTotals.totalFeeDue || 0);
    const totalFeeCollected = Number(feeCollectedSnap?.data().totalFeeCollected || feeTotals.totalPaid || 0);
    const totalFeeOutstanding = totalFeeDue;
    const studentsWithOutstandingFees = Number(studentsWithOutstandingSnap?.data().count || 0);
    const averageAnnualFee = totalStudents > 0 ? totalFeeAmount / totalStudents : 0;
    const studentsWithConcession = Number(concessionTotals.studentsWithConcession || 0);
    const totalConcessionAmount = Number(concessionTotals.totalConcessionAmount || 0);
    const pendingApprovals = Number(pendingConcessionsSnap.data().count || 0);
    const monthlyCollection = Number(monthlyCollectionSnap?.data().monthlyCollection || 0);

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
