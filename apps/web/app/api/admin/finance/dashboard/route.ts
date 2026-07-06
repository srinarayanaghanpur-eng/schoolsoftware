import { NextResponse } from "next/server";
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreAggregateRead, logFirestoreRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

type MoneyEntry = {
  date: string;
  type: "Income" | "Expense";
  description: string;
  category: string;
  amount: number;
  status: string;
};

const COLORS = {
  collected: "#4f63f6",
  pending: "#9b7cff",
  expense: "#f97373"
};

function toDateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function parseRange(url: string) {
  const { searchParams } = new URL(url);
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: searchParams.get("from") || toDateKey(defaultFrom),
    to: searchParams.get("to") || toDateKey(defaultTo)
  };
}

function amount(value: unknown) {
  return Number(value) || 0;
}

function formatINR(value: number) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function weekLabel(dateKey: string) {
  const day = Number(dateKey.slice(8, 10)) || 1;
  const week = Math.floor((day - 1) / 7) + 1;
  return `Week ${week}`;
}

function addWeek(
  map: Map<string, { name: string; income: number; expense: number }>,
  dateKey: string,
  field: "income" | "expense",
  value: number,
  from: string,
  to: string
) {
  if (!inRange(dateKey, from, to)) return;
  const label = weekLabel(dateKey);
  const row = map.get(label) ?? { name: label, income: 0, expense: 0 };
  row[field] += value;
  map.set(label, row);
}

function sortEntriesDesc(left: MoneyEntry, right: MoneyEntry) {
  return right.date.localeCompare(left.date) || Math.abs(right.amount) - Math.abs(left.amount);
}

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const { from, to } = parseRange(req.url);
  const db = adminDb();
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T23:59:59.999`);
  const today = toDateKey(new Date());
  const todayStart = new Date(`${today}T00:00:00`);
  const todayEnd = new Date(`${today}T23:59:59.999`);

  // Scope fee summaries to the active academic year so old-year/leftover
  // summary docs don't inflate the totals (keeps this page in sync with the
  // admin dashboard).
  const activeYearSnap = await db.collection("academic_years").where("isActive", "==", true).limit(1).get().catch(() => null);
  const activeYearId = activeYearSnap?.docs[0]?.id ?? "";
  const scopedSummaries = activeYearId
    ? db.collection("studentFeeSummaries").where("academicYearId", "==", activeYearId)
    : db.collection("studentFeeSummaries");

  const [feeTotalsSnap, studentsPendingSnap, todayPaymentsSnap, paymentsSnap, incomesSnap, expensesSnap, salarySnap, advancesSnap] = await Promise.all([
    scopedSummaries.aggregate({
      totalFeeAmount: AggregateField.sum("totalFee"),
      outstandingDues: AggregateField.sum("dueAmount")
    }).get().catch(() => null),
    scopedSummaries.where("dueAmount", ">", 0).count().get().catch(() => null),
    db.collection("payments")
      .where("createdAt", ">=", todayStart)
      .where("createdAt", "<=", todayEnd)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get()
      .catch(() => null),
    // Each list query is independently fault-tolerant: a missing composite
    // index (or transient error) on one collection degrades that section to
    // empty instead of failing the whole dashboard with "Request failed".
    db.collection("payments").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(300).get().catch(() => null),
    db.collection("incomes").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(300).get().catch(() => null),
    db.collection("expenses").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(300).get().catch(() => null),
    db.collection("salary_reports").where("paidAt", ">=", fromDate).where("paidAt", "<=", toDate).orderBy("paidAt", "desc").limit(300).get().catch(() => null),
    db.collection("salary_advances").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(300).get().catch(() => null)
  ]);

  const EMPTY_DOCS: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const paymentsDocs = paymentsSnap?.docs ?? EMPTY_DOCS;
  const incomesDocs = incomesSnap?.docs ?? EMPTY_DOCS;
  const expensesDocs = expensesSnap?.docs ?? EMPTY_DOCS;
  const salaryDocs = salarySnap?.docs ?? EMPTY_DOCS;
  const advancesDocs = advancesSnap?.docs ?? EMPTY_DOCS;

  logFirestoreAggregateRead("FinanceDashboardAPI", "studentFeeSummaries", { operation: "sum-total-and-due" });
  logFirestoreRead("FinanceDashboardAPI", "payments", todayPaymentsSnap, { from: today, to: today, statusFilter: "completed", purpose: "today-sum", limit: 500 });
  logFirestoreRead("FinanceDashboardAPI", "payments", paymentsSnap, { from, to, limit: 300 });
  logFirestoreRead("FinanceDashboardAPI", "incomes", incomesSnap, { from, to, limit: 300 });
  logFirestoreRead("FinanceDashboardAPI", "expenses", expensesSnap, { from, to, statusFilter: "approved", limit: 300 });
  logFirestoreRead("FinanceDashboardAPI", "salary_reports", salarySnap, { from, to, paidFilter: true, limit: 300 });
  logFirestoreRead("FinanceDashboardAPI", "salary_advances", advancesSnap, { from, to, limit: 300 });

  const feeTotals = (feeTotalsSnap?.data() ?? {}) as Record<string, unknown>;
  const totalFeeAmount = amount(feeTotals.totalFeeAmount);
  const outstandingDues = amount(feeTotals.outstandingDues);
  const studentsPending = Number(studentsPendingSnap?.data().count || 0);

  let feeIncome = 0;
  let otherIncome = 0;
  let expenseTotal = 0;
  const todayCollected = (todayPaymentsSnap?.docs ?? EMPTY_DOCS).reduce((sum, doc) => {
    const data = doc.data();
    if (String(data.status || "").toLowerCase() !== "completed") return sum;
    return sum + amount(data.amountPaid);
  }, 0);
  const byWeek = new Map<string, { name: string; income: number; expense: number }>();
  const transactions: MoneyEntry[] = [];

  paymentsDocs.forEach((doc) => {
    const data = doc.data();
    if (String(data.status || "").toLowerCase() === "cancelled") return;
    const date = docDateKey(data, "paymentDate");
    const paid = amount(data.amountPaid);
    if (!inRange(date, from, to)) return;
    feeIncome += paid;
    addWeek(byWeek, date, "income", paid, from, to);
    transactions.push({
      date,
      type: "Income",
      description: String(data.studentName || data.paymentType || "Fee payment"),
      category: String(data.paymentMethod || "fee"),
      amount: paid,
      status: String(data.status || "completed")
    });
  });

  incomesDocs.forEach((doc) => {
    const data = doc.data();
    const date = docDateKey(data);
    if (!inRange(date, from, to)) return;
    const value = amount(data.amount);
    otherIncome += value;
    addWeek(byWeek, date, "income", value, from, to);
    transactions.push({
      date,
      type: "Income",
      description: String(data.description || "Other income"),
      category: String(data.category || "income"),
      amount: value,
      status: "recorded"
    });
  });

  expensesDocs.forEach((doc) => {
    const data = doc.data();
    if (String(data.status || "").toLowerCase() !== "approved") return;
    const date = docDateKey(data);
    if (!inRange(date, from, to)) return;
    const value = amount(data.amount);
    expenseTotal += value;
    addWeek(byWeek, date, "expense", value, from, to);
    transactions.push({
      date,
      type: "Expense",
      description: String(data.description || "Expense"),
      category: String(data.category || "expense"),
      amount: value,
      status: String(data.status || "approved")
    });
  });

  salaryDocs.forEach((doc) => {
    const data = doc.data();
    if (data.paid !== true) return;
    const date = docDateKey(data, "paidAt", "month");
    if (!inRange(date, from, to)) return;
    const value = amount(data.netPayable);
    expenseTotal += value;
    addWeek(byWeek, date, "expense", value, from, to);
    transactions.push({
      date,
      type: "Expense",
      description: `Salary · ${String(data.teacherName || data.teacherId || "")}`,
      category: "salary",
      amount: value,
      status: "paid"
    });
  });

  advancesDocs.forEach((doc) => {
    const data = doc.data();
    const date = docDateKey(data);
    if (!inRange(date, from, to)) return;
    const value = amount(data.amount);
    expenseTotal += value;
    addWeek(byWeek, date, "expense", value, from, to);
    transactions.push({
      date,
      type: "Expense",
      description: `Advance · ${String(data.teacherName || data.teacherId || "")}`,
      category: "salary advance",
      amount: value,
      status: data.recovered ? "recovered" : "open"
    });
  });

  const incomeTotal = feeIncome + otherIncome;
  const collectionTarget = Math.max(totalFeeAmount, feeIncome + outstandingDues);
  const collectedPercent = collectionTarget > 0 ? Math.round((feeIncome / collectionTarget) * 100) : 0;
  const pendingPercent = collectionTarget > 0 ? Math.max(0, 100 - collectedPercent) : 0;

  const bars = Array.from(byWeek.values())
    .sort((left, right) => Number(left.name.replace("Week ", "")) - Number(right.name.replace("Week ", "")))
    .map((row) => ({
      ...row,
      incomeLakhs: Number((row.income / 100000).toFixed(2)),
      expenseLakhs: Number((row.expense / 100000).toFixed(2))
    }));

  return NextResponse.json({
    ok: true,
    range: { from, to },
    kpis: {
      totalIncome: incomeTotal,
      totalExpense: expenseTotal,
      netBalance: incomeTotal - expenseTotal,
      outstandingDues,
      studentsPending,
      todayCollected,
      paymentCount: paymentsDocs.length
    },
    feeCollection: [
      {
        name: "Collected",
        value: feeIncome,
        percent: collectedPercent,
        label: formatINR(feeIncome),
        color: COLORS.collected
      },
      {
        name: "Pending",
        value: outstandingDues,
        percent: pendingPercent,
        label: formatINR(outstandingDues),
        color: COLORS.pending
      }
    ],
    collectionTarget,
    bars,
    transactions: transactions.sort(sortEntriesDesc)
  });
}
