import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

type DeletedBill = { id: string; type: string; category: string; amount: number; date: string; description: string; deletedBy?: string; deletedAt?: string; reason?: string };

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || defaultTo;
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59.999`);
  const db = adminDb();

  const auditSnap = await db.collection("audit_logs")
    .where("action", "in", ["expense.deleted", "payment.cancelled", "income.deleted"])
    .where("createdAt", ">=", fromDate)
    .where("createdAt", "<=", toDate)
    .orderBy("createdAt", "desc")
    .limit(500)
    .get();

  // Also check for cancelled/rejected records in expenses
  const [expensesSnap, paymentsSnap] = await Promise.all([
    db.collection("expenses").where("status", "==", "rejected").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(500).get(),
    db.collection("payments").where("status", "==", "cancelled").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(500).get()
  ]);
  logFirestoreRead("FinanceDeletedBillsAPI", "audit_logs", auditSnap, { from, to, limit: 500 });
  logFirestoreRead("FinanceDeletedBillsAPI", "expenses", expensesSnap, { from, to, status: "rejected", limit: 500 });
  logFirestoreRead("FinanceDeletedBillsAPI", "payments", paymentsSnap, { from, to, status: "cancelled", limit: 500 });

  const bills: DeletedBill[] = [];

  auditSnap.docs.forEach((d) => {
    const data = d.data();
    const key = docDateKey(data);
    if (!inRange(key, from, to)) return;
    const action = String(data.action || "");
    bills.push({
      id: d.id,
      type: action.includes("expense") ? "expense" : action.includes("payment") || action.includes("fee") ? "payment" : "income",
      category: String(data.entityType || action),
      amount: Number(data.newValues?.amount || data.oldValues?.amount || 0),
      date: key,
      description: String(data.reason || `Deleted ${action}`),
      deletedBy: String(data.actorId || ""),
      deletedAt: key,
      reason: String(data.reason || "")
    });
  });

  expensesSnap.docs.forEach((d) => {
    const data = d.data();
    const key = docDateKey(data);
    if (!inRange(key, from, to)) return;
    bills.push({
      id: d.id,
      type: "expense",
      category: String(data.category || "expense"),
      amount: Number(data.amount || 0),
      date: key,
      description: `Rejected: ${data.description || ""}`,
      deletedBy: String(data.reviewedBy || ""),
      deletedAt: key,
      reason: "Rejected"
    });
  });

  paymentsSnap.docs.forEach((d) => {
    const data = d.data();
    const key = docDateKey(data);
    if (!inRange(key, from, to)) return;
    bills.push({
      id: d.id,
      type: "payment",
      category: "fee",
      amount: Number(data.amountPaid || 0),
      date: key,
      description: `Cancelled payment: ${data.paymentType || ""}`,
      deletedBy: String(data.cancelledBy || ""),
      deletedAt: key,
      reason: String(data.cancelReason || "")
    });
  });

  bills.sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ ok: true, bills, count: bills.length });
}
