import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";

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
    const paymentsSnap = await db.collection("payments").where("status", "==", "completed").get();

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
