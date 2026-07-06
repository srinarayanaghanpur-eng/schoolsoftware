import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

// GET /api/admin/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Profit & Loss: income (fees + other) vs expense (general + salary + advances).
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

  const [paymentsSnap, incomesSnap, expensesSnap, salarySnap, advancesSnap] = await Promise.all([
    db.collection("payments").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("incomes").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("expenses").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("salary_reports").where("paidAt", ">=", fromDate).where("paidAt", "<=", toDate).orderBy("paidAt", "desc").limit(1000).get(),
    db.collection("salary_advances").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get()
  ]);
  logFirestoreRead("FinanceSummaryAPI", "payments", paymentsSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceSummaryAPI", "incomes", incomesSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceSummaryAPI", "expenses", expensesSnap, { from, to, statusFilter: "approved", limit: 1000 });
  logFirestoreRead("FinanceSummaryAPI", "salary_reports", salarySnap, { from, to, paidFilter: true, limit: 1000 });
  logFirestoreRead("FinanceSummaryAPI", "salary_advances", advancesSnap, { from, to, limit: 1000 });

  const sum = (snap: FirebaseFirestore.QuerySnapshot, field: string, prefer: string[] = [], filter: (data: Record<string, unknown>) => boolean = () => true) =>
    snap.docs.reduce((acc, d) => {
      const data = d.data();
      return filter(data) && inRange(docDateKey(data, ...prefer), from, to) ? acc + (Number(data[field]) || 0) : acc;
    }, 0);

  const fees = sum(paymentsSnap, "amountPaid");
  const other = sum(incomesSnap, "amount");
  const general = sum(expensesSnap, "amount", [], (data) => String(data.status || "").toLowerCase() === "approved");
  const salary = sum(salarySnap, "netPayable", ["paidAt", "month"], (data) => data.paid === true);
  const advances = sum(advancesSnap, "amount");

  const incomeTotal = fees + other;
  const expenseTotal = general + salary + advances;

  return NextResponse.json({
    ok: true,
    summary: {
      from: from || "all",
      to: to || "all",
      income: { fees, other, total: incomeTotal },
      expense: { general, salary, advances, total: expenseTotal },
      net: incomeTotal - expenseTotal
    }
  });
}
