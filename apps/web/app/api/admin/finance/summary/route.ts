import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";

// GET /api/admin/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Profit & Loss: income (fees + other) vs expense (general + salary + advances).
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

  const sum = (snap: FirebaseFirestore.QuerySnapshot, field: string, prefer: string[] = []) =>
    snap.docs.reduce((acc, d) => {
      const data = d.data();
      return inRange(docDateKey(data, ...prefer), from, to) ? acc + (Number(data[field]) || 0) : acc;
    }, 0);

  const fees = sum(paymentsSnap, "amountPaid");
  const other = sum(incomesSnap, "amount");
  const general = sum(expensesSnap, "amount");
  const salary = sum(salarySnap, "netPayable", ["paidAt", "month"]);
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
