import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from "@/lib/firebaseAdmin";
import { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports/user-wise
 * Collection totals grouped by the user (cashier/admin) who recorded each payment.
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
    const [paymentsSnap, usersSnap] = await Promise.all([
      db.collection("payments")
        .where("status", "==", "completed")
        .where("createdAt", ">=", fromDate)
        .where("createdAt", "<=", toDate)
        .orderBy("createdAt", "desc")
        .limit(1000)
        .get(),
      db.collection("users").get()
    ]);
    logFirestoreRead("UserWiseReportAPI", "payments", paymentsSnap, { from, to, status: "completed", limit: 1000 });
    logFirestoreRead("UserWiseReportAPI", "users", usersSnap, { purpose: "display-names" });

    // Map uid -> display name for readable rows.
    const nameByUid: Record<string, string> = {};
    usersSnap.docs.forEach((doc: QueryDocumentSnapshot) => {
      const data = doc.data();
      nameByUid[doc.id] = (data.displayName as string) || (data.internalEmail as string) || doc.id;
    });

    const byUser: Record<string, { collectedBy: string; transactions: number; totalCollected: number }> = {};
    paymentsSnap.docs.forEach((doc: QueryDocumentSnapshot) => {
      const p = doc.data();
      const uid = (p.paidBy as string) || (p.paidByName as string) || "unknown";
      const label = (p.paidByName as string) || nameByUid[uid] || uid;
      if (!byUser[uid]) byUser[uid] = { collectedBy: label, transactions: 0, totalCollected: 0 };
      byUser[uid].transactions += 1;
      byUser[uid].totalCollected += Number(p.amountPaid || 0);
    });

    const data = Object.values(byUser).sort((a, b) => b.totalCollected - a.totalCollected);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error generating user-wise report:", error);
    return NextResponse.json({ success: false, error: "Failed to generate report" }, { status: 500 });
  }
}
