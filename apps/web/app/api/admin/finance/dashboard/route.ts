import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuthenticated, resolveRole, json } from "@/lib/apiUtils";
import { roleHasPermission } from "@/lib/rbacAdmin";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { aggregateCollectionByMethod, aggregateDuesByClass, aggregateExpenseBreakdown, isCompletedStatus } from "@/lib/financeAggregation";
import { logFirestoreAggregateRead, logFirestoreRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

// In-memory response cache: identical range requests within the TTL reuse the
// previous result instead of re-running ~10 Firestore queries per page visit.
// This is the single biggest quota saver for the finance dashboard.
const CACHE_TTL_MS = 60_000;
const responseCache = new Map<string, { at: number; payload: unknown }>();

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
  const decoded = await requireAuthenticated(req);
  if (!decoded) {
    return json({ ok: false, error: "Authentication required. Please sign in again." }, { status: 401 });
  }
  const role = await resolveRole(decoded);
  if (!role || !await roleHasPermission(role, "fees.view")) {
    return json({ ok: false, error: "Access denied. You do not have permission to view finance." }, { status: 403 });
  }

  const { from, to } = parseRange(req.url);

  // Serve from cache unless the caller explicitly refreshes (?refresh=1,
  // used by the dashboard's refresh button) or the entry expired.
  const { searchParams } = new URL(req.url);
  const cacheKey = `${from}_${to}`;
  const forceRefresh = searchParams.get("refresh") === "1";
  const cached = responseCache.get(cacheKey);
  if (!forceRefresh && cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return json(cached.payload as Record<string, unknown>);
  }

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

  const [feeTotalsSnap, studentsPendingSnap, todayPaymentsSnap, paymentsSnap, incomesSnap, expensesSnap, salarySnap, advancesSnap, duesSummariesSnap, classesSnap] = await Promise.all([
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
    db.collection("salary_advances").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(300).get().catch(() => null),
    // Dues by class: reuse the per-student summary docs (one query, no
    // per-student reads). select() keeps the payload small.
    scopedSummaries.select("studentId", "className", "classId", "dueAmount", "totalFee", "totalConcession", "totalPaid", "feeStatus", "deleted", "active").limit(2000).get().catch(() => null),
    db.collection("classes").select("className", "name").limit(200).get().catch(() => null)
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
  logFirestoreRead("FinanceDashboardAPI", "studentFeeSummaries", duesSummariesSnap, { purpose: "dues-by-class", academicYearId: activeYearId, limit: 2000 });
  logFirestoreRead("FinanceDashboardAPI", "classes", classesSnap, { purpose: "class-name-map", limit: 200 });

  const feeTotals = (feeTotalsSnap?.data() ?? {}) as Record<string, unknown>;
  const totalFeeAmount = amount(feeTotals.totalFeeAmount);
  const outstandingDues = amount(feeTotals.outstandingDues);
  const studentsPending = Number(studentsPendingSnap?.data().count || 0);

  let feeIncome = 0;
  let otherIncome = 0;
  let expenseTotal = 0;
  const todayCollected = (todayPaymentsSnap?.docs ?? EMPTY_DOCS).reduce((sum, doc) => {
    const data = doc.data();
    if (!isCompletedStatus(data.status)) return sum;
    return sum + amount(data.amountPaid);
  }, 0);
  const byWeek = new Map<string, { name: string; income: number; expense: number }>();
  const transactions: MoneyEntry[] = [];

  paymentsDocs.forEach((doc) => {
    const data = doc.data();
    // Count only genuinely completed payments (handles completed/Completed/
    // paid; excludes cancelled, failed, refunded, pending).
    if (!isCompletedStatus(data.status)) return;
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

  // ---- Summary card aggregations (computed from the docs fetched above; no
  // extra reads beyond the single summaries/classes queries) ----
  // Collection by Method uses the SAME payments docs that feed Recent
  // Transactions, so both cards always agree.
  const collectionByMethod = aggregateCollectionByMethod([
    ...paymentsDocs.map((doc) => ({ id: doc.id, data: doc.data() })),
    ...incomesDocs.map((doc) => ({ id: doc.id, data: { ...doc.data(), status: "completed" } }))
  ].filter((p) => inRange(docDateKey(p.data, "paymentDate"), from, to)));

  const classNamesById = new Map<string, string>();
  (classesSnap?.docs ?? EMPTY_DOCS).forEach((doc) => {
    const d = doc.data();
    classNamesById.set(doc.id, String(d.className || d.name || doc.id));
  });
  const duesByClass = aggregateDuesByClass(
    (duesSummariesSnap?.docs ?? EMPTY_DOCS).map((doc) => ({ id: doc.id, data: doc.data() })),
    classNamesById
  );

  const expenseBreakdown = aggregateExpenseBreakdown(
    expensesDocs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter((e) => inRange(docDateKey(e.data), from, to))
  );

  const payload = {
    ok: true,
    range: { from, to },
    collectionByMethod,
    duesByClass,
    expenseBreakdown,
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
  };

  responseCache.set(cacheKey, { at: Date.now(), payload });
  // Keep the cache tiny — only a handful of ranges are ever requested.
  if (responseCache.size > 20) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) responseCache.delete(oldest[0]);
  }

  return json(payload);
}

