import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";

type Entry = { date: string; type: "income" | "expense"; category: string; description: string; amount: number; source: string; refId?: string };

// GET /api/admin/finance/ledger?from=&to= — combined money in/out timeline with running balance.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const db = adminDb();

  const [paymentsSnap, incomesSnap, expensesSnap, salarySnap, advancesSnap] = await Promise.all([
    db.collection("payments").get(),
    db.collection("incomes").get(),
    db.collection("expenses").where("status", "==", "approved").get(),
    db.collection("salary_reports").where("paid", "==", true).get(),
    db.collection("salary_advances").get()
  ]);

  const entries: Entry[] = [];
  const push = (snap: FirebaseFirestore.QuerySnapshot, map: (d: Record<string, unknown>, id: string) => Entry | null, prefer: string[] = []) => {
    snap.docs.forEach((d) => {
      const data = d.data();
      const key = docDateKey(data, ...prefer);
      if (!inRange(key, from, to)) return;
      const e = map(data, d.id);
      if (e) entries.push({ ...e, date: key });
    });
  };

  push(paymentsSnap, (d, id) => ({ date: "", type: "income", category: "fee", description: `Fee · ${d.paymentType || ""}`, amount: Number(d.amountPaid) || 0, source: "fee", refId: id }));
  push(incomesSnap, (d, id) => ({ date: "", type: "income", category: String(d.category || "income"), description: String(d.description || ""), amount: Number(d.amount) || 0, source: "income", refId: id }));
  push(expensesSnap, (d, id) => ({ date: "", type: "expense", category: String(d.category || "expense"), description: String(d.description || ""), amount: Number(d.amount) || 0, source: "expense", refId: id }));
  push(salarySnap, (d, id) => ({ date: "", type: "expense", category: "salary", description: `Salary · ${d.teacherName || ""} ${d.month || ""}`, amount: Number(d.netPayable) || 0, source: "salary", refId: id }), ["paidAt", "month"]);
  push(advancesSnap, (d, id) => ({ date: "", type: "expense", category: "salary_advance", description: `Advance · ${d.teacherName || ""}`, amount: Number(d.amount) || 0, source: "advance", refId: id }));

  // oldest → newest to compute running balance, then return newest first
  entries.sort((a, b) => a.date.localeCompare(b.date));
  let balance = 0;
  const withBalance = entries.map((e) => {
    balance += e.type === "income" ? e.amount : -e.amount;
    return { ...e, balance };
  });
  withBalance.reverse();

  return NextResponse.json({ ok: true, entries: withBalance, closingBalance: balance });
}
