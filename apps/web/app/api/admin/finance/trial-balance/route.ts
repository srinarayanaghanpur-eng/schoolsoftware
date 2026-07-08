import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

type TBEntry = { account: string; type: "debit" | "credit"; amount: number; nature: string };

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

  const [paymentsSnap, incomesSnap, expensesSnap, salarySnap, advancesSnap, purchasesSnap] = await Promise.all([
    db.collection("payments").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("incomes").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("expenses").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("salary_reports").where("paidAt", ">=", fromDate).where("paidAt", "<=", toDate).orderBy("paidAt", "desc").limit(1000).get(),
    db.collection("salary_advances").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("purchases").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get()
  ]);
  logFirestoreRead("FinanceTrialBalanceAPI", "payments", paymentsSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceTrialBalanceAPI", "incomes", incomesSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceTrialBalanceAPI", "expenses", expensesSnap, { from, to, statusFilter: "approved", limit: 1000 });
  logFirestoreRead("FinanceTrialBalanceAPI", "salary_reports", salarySnap, { from, to, paidFilter: true, limit: 1000 });
  logFirestoreRead("FinanceTrialBalanceAPI", "salary_advances", advancesSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceTrialBalanceAPI", "purchases", purchasesSnap, { from, to, limit: 1000 });

  const filterDocs = (snap: FirebaseFirestore.QuerySnapshot, prefer: string[] = [], filter: (data: Record<string, unknown>) => boolean = () => true) =>
    snap.docs.filter((d) => {
      const data = d.data();
      return filter(data) && inRange(docDateKey(data, ...prefer), from, to);
    });

  const sumField = (docs: FirebaseFirestore.QueryDocumentSnapshot[], field: string) =>
    docs.reduce((acc, d) => acc + (Number(d.data()[field]) || 0), 0);

  const feePayments = filterDocs(paymentsSnap);
  const incomes = filterDocs(incomesSnap);
  const expenses = filterDocs(expensesSnap, [], (data) => String(data.status || "").toLowerCase() === "approved");
  const salaries = filterDocs(salarySnap, ["paidAt", "month"], (data) => data.paid === true);
  const advances = filterDocs(advancesSnap);
  const purchases = filterDocs(purchasesSnap);

  const totalExpenses = sumField(expenses, "amount");
  const totalSalary = sumField(salaries, "netPayable");
  const totalAdvances = sumField(advances, "amount");
  const totalPurchases = sumField(purchases, "amount");

  const debitEntries: TBEntry[] = [];
  if (totalExpenses > 0) debitEntries.push({ account: "Expenses — General", type: "debit", amount: totalExpenses, nature: "expense" });
  if (totalSalary > 0) debitEntries.push({ account: "Expenses — Salary", type: "debit", amount: totalSalary, nature: "expense" });
  if (totalAdvances > 0) debitEntries.push({ account: "Salary Advances", type: "debit", amount: totalAdvances, nature: "asset" });
  if (totalPurchases > 0) debitEntries.push({ account: "Purchases / Payables", type: "debit", amount: totalPurchases, nature: "liability" });

  const creditEntries: TBEntry[] = [];
  const feeTotal = sumField(feePayments, "amountPaid");
  const otherTotal = sumField(incomes, "amount");
  if (feeTotal > 0) creditEntries.push({ account: "Fee Collections", type: "credit", amount: feeTotal, nature: "income" });
  if (otherTotal > 0) creditEntries.push({ account: "Other Income", type: "credit", amount: otherTotal, nature: "income" });

  const totalDebit = debitEntries.reduce((s, e) => s + e.amount, 0);
  const totalCredit = creditEntries.reduce((s, e) => s + e.amount, 0);

  return json({
    ok: true,
    from: from || "all",
    to: to || "all",
    debitEntries,
    creditEntries,
    totalDebit,
    totalCredit,
    difference: totalDebit - totalCredit
  });
}

