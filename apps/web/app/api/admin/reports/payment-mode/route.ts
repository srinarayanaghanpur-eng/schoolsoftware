import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/payment-mode
 * Collection totals grouped by payment mode (cash / UPI / bank / cheque / card).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, "reports.view");
    if (!auth) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const db = adminDb();
    const searchParams = request.nextUrl.searchParams;
    const now = new Date();
    const from = searchParams.get("from") || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = searchParams.get("to") || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59.999`);
    const paymentsSnap = await db.collection("payments")
      .where("status", "==", "completed")
      .where("createdAt", ">=", fromDate)
      .where("createdAt", "<=", toDate)
      .orderBy("createdAt", "desc")
      .limit(1000)
      .get();
    logFirestoreRead("PaymentModeReportAPI", "payments", paymentsSnap, { from, to, status: "completed", limit: 1000 });

    const byMode: Record<string, { paymentMode: string; transactions: number; totalCollected: number }> = {};
    let grandTotal = 0;
    paymentsSnap.docs.forEach((doc: QueryDocumentSnapshot) => {
      const p = doc.data();
      const mode = String(p.paymentMethod || "cash").toUpperCase();
      if (!byMode[mode]) byMode[mode] = { paymentMode: mode, transactions: 0, totalCollected: 0 };
      const amount = Number(p.amountPaid || 0);
      byMode[mode].transactions += 1;
      byMode[mode].totalCollected += amount;
      grandTotal += amount;
    });

    const data = Object.values(byMode)
      .map((row) => ({
        ...row,
        sharePercent: grandTotal > 0 ? Number(((row.totalCollected / grandTotal) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.totalCollected - a.totalCollected);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error generating payment-mode report:", error);
    return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 });
  }
}
