import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";

// GET /api/admin/finance/daily?from=&to= — day-wise income/expense series (for charts).
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const db = adminDb();

  const [paymentsSnap, incomesSnap, expensesSnap] = await Promise.all([
    db.collection("payments").get(),
    db.collection("incomes").get(),
    db.collection("expenses").where("status", "==", "approved").get()
  ]);

  const byDay = new Map<string, { income: number; expense: number }>();
  const add = (key: string, field: "income" | "expense", amount: number) => {
    if (!inRange(key, from, to)) return;
    const e = byDay.get(key) ?? { income: 0, expense: 0 };
    e[field] += amount;
    byDay.set(key, e);
  };

  paymentsSnap.docs.forEach((d) => add(docDateKey(d.data()), "income", Number(d.data().amountPaid) || 0));
  incomesSnap.docs.forEach((d) => add(docDateKey(d.data()), "income", Number(d.data().amount) || 0));
  expensesSnap.docs.forEach((d) => add(docDateKey(d.data()), "expense", Number(d.data().amount) || 0));

  const days = Array.from(byDay.entries())
    .map(([date, v]) => ({ date, income: v.income, expense: v.expense, net: v.income - v.expense }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ ok: true, days });
}
