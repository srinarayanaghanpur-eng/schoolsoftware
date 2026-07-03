import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

type CashEntry = { date: string; type: "income" | "expense"; category: string; description: string; amount: number; balance: number; source: string; refId?: string };

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

  const [paymentsSnap, incomesSnap, expensesSnap] = await Promise.all([
    db.collection("payments").where("paymentMethod", "==", "cash").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(500).get(),
    db.collection("incomes").where("paymentMethod", "==", "cash").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(500).get(),
    db.collection("expenses").where("status", "==", "approved").where("paymentMethod", "==", "cash").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(500).get()
  ]);
  logFirestoreRead("FinanceCashBookAPI", "payments", paymentsSnap, { from, to, paymentMethod: "cash", limit: 500 });
  logFirestoreRead("FinanceCashBookAPI", "incomes", incomesSnap, { from, to, paymentMethod: "cash", limit: 500 });
  logFirestoreRead("FinanceCashBookAPI", "expenses", expensesSnap, { from, to, status: "approved", paymentMethod: "cash", limit: 500 });

  const entries: CashEntry[] = [];
  const push = (snap: FirebaseFirestore.QuerySnapshot, map: (d: Record<string, unknown>, id: string) => CashEntry | null) => {
    snap.docs.forEach((d) => {
      const data = d.data();
      const key = docDateKey(data);
      if (!inRange(key, from, to)) return;
      const e = map(data, d.id);
      if (e) entries.push({ ...e, date: key });
    });
  };

  push(paymentsSnap, (d, id) => ({ date: "", type: "income", category: "fee", description: `Fee · ${d.paymentType || "Payment"}`, amount: Number(d.amountPaid) || 0, balance: 0, source: "fee", refId: id }));
  push(incomesSnap, (d, id) => ({ date: "", type: "income", category: String(d.category || "income"), description: String(d.description || ""), amount: Number(d.amount) || 0, balance: 0, source: "income", refId: id }));
  push(expensesSnap, (d, id) => ({ date: "", type: "expense", category: String(d.category || "expense"), description: String(d.description || ""), amount: Number(d.amount) || 0, balance: 0, source: "expense", refId: id }));

  entries.sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  const withBalance = entries.map((e) => {
    balance += e.type === "income" ? e.amount : -e.amount;
    return { ...e, balance };
  });

  return NextResponse.json({ ok: true, entries: withBalance, closingBalance: balance });
}
