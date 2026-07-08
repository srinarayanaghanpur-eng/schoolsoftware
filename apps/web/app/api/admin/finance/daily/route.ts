import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

// GET /api/admin/finance/daily?from=&to= — day-wise income/expense series (for charts).
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

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
    db.collection("payments").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("incomes").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("expenses").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get()
  ]);
  logFirestoreRead("FinanceDailyAPI", "payments", paymentsSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceDailyAPI", "incomes", incomesSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceDailyAPI", "expenses", expensesSnap, { from, to, statusFilter: "approved", limit: 1000 });

  const byDay = new Map<string, { income: number; expense: number }>();
  const add = (key: string, field: "income" | "expense", amount: number) => {
    if (!inRange(key, from, to)) return;
    const e = byDay.get(key) ?? { income: 0, expense: 0 };
    e[field] += amount;
    byDay.set(key, e);
  };

  paymentsSnap.docs.forEach((d) => add(docDateKey(d.data()), "income", Number(d.data().amountPaid) || 0));
  incomesSnap.docs.forEach((d) => add(docDateKey(d.data()), "income", Number(d.data().amount) || 0));
  expensesSnap.docs.forEach((d) => {
    const data = d.data();
    if (String(data.status || "").toLowerCase() !== "approved") return;
    add(docDateKey(data), "expense", Number(data.amount) || 0);
  });

  const days = Array.from(byDay.entries())
    .map(([date, v]) => ({ date, income: v.income, expense: v.expense, net: v.income - v.expense }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return json({ ok: true, days });
}

