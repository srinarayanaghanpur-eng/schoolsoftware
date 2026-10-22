import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreAggregateRead, logFirestoreRead } from "@/lib/firestoreReadLogger";

// GET /api/admin/finance/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Profit & Loss: income (fees + other) vs expense (general + salary + advances).
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  if (isFirestoreQuotaPaused()) {
    return firestoreQuotaResponse();
  }

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || defaultTo;
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59.999`);
  const db = adminDb();

  // Strict-read path: five aggregates (≈5 reads total) instead of scanning up
  // to 5,000 documents. If an aggregate fails (e.g. missing composite index),
  // fall back to the bounded scan for that data set — never return fake zeros.
  const sumAggregate = async (
    collectionName: string,
    field: string,
    build: (query: FirebaseFirestore.Query) => FirebaseFirestore.Query
  ): Promise<number | null> => {
    try {
      const snap = await build(db.collection(collectionName))
        .aggregate({ total: AggregateField.sum(field) })
        .get();
      return Number(snap.data().total || 0);
    } catch {
      return null;
    }
  };

  const [feesAgg, otherAgg, generalAgg, salaryAgg, advancesAgg] = await Promise.all([
    sumAggregate("payments", "amountPaid", (q) => q.where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate)),
    sumAggregate("incomes", "amount", (q) => q.where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate)),
    sumAggregate("expenses", "amount", (q) => q.where("status", "==", "approved").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate)),
    sumAggregate("salary_reports", "netPayable", (q) => q.where("paid", "==", true).where("paidAt", ">=", fromDate).where("paidAt", "<=", toDate)),
    sumAggregate("salary_advances", "amount", (q) => q.where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate))
  ]);

  logFirestoreAggregateRead("FinanceSummaryAPI", "payments", { operation: "sum-amountPaid", from, to });
  logFirestoreAggregateRead("FinanceSummaryAPI", "incomes", { operation: "sum-amount", from, to });
  logFirestoreAggregateRead("FinanceSummaryAPI", "expenses", { operation: "sum-approved", from, to });
  logFirestoreAggregateRead("FinanceSummaryAPI", "salary_reports", { operation: "sum-paid", from, to });
  logFirestoreAggregateRead("FinanceSummaryAPI", "salary_advances", { operation: "sum-amount", from, to });

  let scannedFees = 0;
  let scannedOther = 0;
  let scannedGeneral = 0;
  let scannedSalary = 0;
  let scannedAdvances = 0;

  if ([feesAgg, otherAgg, generalAgg, salaryAgg, advancesAgg].some((value) => value === null)) {
    const [paymentsSnap, incomesSnap, expensesSnap, salarySnap, advancesSnap] = await Promise.all([
      db.collection("payments").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
      db.collection("incomes").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
      db.collection("expenses").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
      db.collection("salary_reports").where("paidAt", ">=", fromDate).where("paidAt", "<=", toDate).orderBy("paidAt", "desc").limit(1000).get(),
      db.collection("salary_advances").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get()
    ]);
    logFirestoreRead("FinanceSummaryAPI", "payments", paymentsSnap, { from, to, limit: 1000, fallback: true });
    logFirestoreRead("FinanceSummaryAPI", "incomes", incomesSnap, { from, to, limit: 1000, fallback: true });
    logFirestoreRead("FinanceSummaryAPI", "expenses", expensesSnap, { from, to, statusFilter: "approved", limit: 1000, fallback: true });
    logFirestoreRead("FinanceSummaryAPI", "salary_reports", salarySnap, { from, to, paidFilter: true, limit: 1000, fallback: true });
    logFirestoreRead("FinanceSummaryAPI", "salary_advances", advancesSnap, { from, to, limit: 1000, fallback: true });

    const sum = (snap: FirebaseFirestore.QuerySnapshot, field: string, prefer: string[] = [], filter: (data: Record<string, unknown>) => boolean = () => true) =>
      snap.docs.reduce((acc, d) => {
        const data = d.data();
        return filter(data) && inRange(docDateKey(data, ...prefer), from, to) ? acc + (Number(data[field]) || 0) : acc;
      }, 0);

    scannedFees = sum(paymentsSnap, "amountPaid");
    scannedOther = sum(incomesSnap, "amount");
    scannedGeneral = sum(expensesSnap, "amount", [], (data) => String(data.status || "").toLowerCase() === "approved");
    scannedSalary = sum(salarySnap, "netPayable", ["paidAt", "month"], (data) => data.paid === true);
    scannedAdvances = sum(advancesSnap, "amount");
  }

  const fees = feesAgg ?? scannedFees;
  const other = otherAgg ?? scannedOther;
  const general = generalAgg ?? scannedGeneral;
  const salary = salaryAgg ?? scannedSalary;
  const advances = advancesAgg ?? scannedAdvances;

  const incomeTotal = fees + other;
  const expenseTotal = general + salary + advances;

  return json({
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

