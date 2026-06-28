import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";

type Breakdown = { label: string; amount: number };

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

  const filterDocs = (snap: FirebaseFirestore.QuerySnapshot, prefer: string[] = []) =>
    snap.docs.filter((d) => inRange(docDateKey(d.data(), ...prefer), from, to));

  const sumField = (docs: FirebaseFirestore.QueryDocumentSnapshot[], field: string) =>
    docs.reduce((acc, d) => acc + (Number(d.data()[field]) || 0), 0);

  const groupSum = (docs: FirebaseFirestore.QueryDocumentSnapshot[], field: string, groupKey: string) => {
    const map: Record<string, number> = {};
    docs.forEach((d) => {
      const val = String(d.data()[groupKey] || "other");
      map[val] = (map[val] || 0) + (Number(d.data()[field]) || 0);
    });
    return Object.entries(map).map(([key, amount]) => ({ category: key, amount }));
  };

  const fees = filterDocs(paymentsSnap);
  const otherIncome = filterDocs(incomesSnap);
  const expenses = filterDocs(expensesSnap);
  const salaries = filterDocs(salarySnap, ["paidAt", "month"]);
  const advances = filterDocs(advancesSnap);

  const incomeBreakdown: Breakdown[] = [];
  const feeTotal = sumField(fees, "amountPaid");
  if (feeTotal > 0) incomeBreakdown.push({ label: "Fee Collections", amount: feeTotal });
  groupSum(otherIncome, "amount", "category").forEach((g) => {
    if (g.amount > 0) incomeBreakdown.push({ label: `Other Income — ${g.category}`, amount: g.amount });
  });

  const expenseBreakdown: Breakdown[] = [];
  groupSum(expenses, "amount", "category").forEach((g) => {
    if (g.amount > 0) expenseBreakdown.push({ label: `Expense — ${g.category}`, amount: g.amount });
  });
  const salaryTotal = sumField(salaries, "netPayable");
  if (salaryTotal > 0) expenseBreakdown.push({ label: "Salary Paid", amount: salaryTotal });
  const advanceTotal = sumField(advances, "amount");
  if (advanceTotal > 0) expenseBreakdown.push({ label: "Salary Advances", amount: advanceTotal });

  const totalIncome = incomeBreakdown.reduce((s, g) => s + g.amount, 0);
  const totalExpense = expenseBreakdown.reduce((s, g) => s + g.amount, 0);
  const netProfit = totalIncome - totalExpense;

  return NextResponse.json({
    ok: true,
    from: from || "all",
    to: to || "all",
    income: { breakdown: incomeBreakdown, total: totalIncome },
    expense: { breakdown: expenseBreakdown, total: totalExpense },
    netProfit
  });
}
