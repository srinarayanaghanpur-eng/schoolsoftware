import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey, inRange } from "@/lib/financeUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

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

  const [paymentsSnap, incomesSnap, expensesSnap, branchesSnap] = await Promise.all([
    db.collection("payments").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("incomes").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("expenses").where("createdAt", ">=", fromDate).where("createdAt", "<=", toDate).orderBy("createdAt", "desc").limit(1000).get(),
    db.collection("branches").get()
  ]);
  logFirestoreRead("FinanceBranchAccountsAPI", "payments", paymentsSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceBranchAccountsAPI", "incomes", incomesSnap, { from, to, limit: 1000 });
  logFirestoreRead("FinanceBranchAccountsAPI", "expenses", expensesSnap, { from, to, statusFilter: "approved", limit: 1000 });
  logFirestoreRead("FinanceBranchAccountsAPI", "branches", branchesSnap, { purpose: "branch-names" });

  const branches = branchesSnap.docs.map((d) => ({ id: d.id, name: String(d.data().name || "") }));
  const addToBranch = (bid: string, type: "income" | "expense", amount: number, byBranch: Record<string, { branchId: string; branchName: string; income: number; expense: number; net: number }>) => {
    if (!byBranch[bid]) {
      const b = branches.find((br) => br.id === bid);
      byBranch[bid] = { branchId: bid, branchName: b?.name || bid, income: 0, expense: 0, net: 0 };
    }
    byBranch[bid][type] += amount;
    byBranch[bid].net = byBranch[bid].income - byBranch[bid].expense;
  };

  const byBranch: Record<string, { branchId: string; branchName: string; income: number; expense: number; net: number }> = {};

  paymentsSnap.docs.forEach((d) => {
    const data = d.data();
    if (inRange(docDateKey(data), from, to)) addToBranch(String(data.branchId || "default"), "income", Number(data.amountPaid) || 0, byBranch);
  });
  incomesSnap.docs.forEach((d) => {
    const data = d.data();
    if (inRange(docDateKey(data), from, to)) addToBranch(String(data.branchId || "default"), "income", Number(data.amount) || 0, byBranch);
  });
  expensesSnap.docs.forEach((d) => {
    const data = d.data();
    if (String(data.status || "").toLowerCase() !== "approved") return;
    if (inRange(docDateKey(data), from, to)) addToBranch(String(data.branchId || "default"), "expense", Number(data.amount) || 0, byBranch);
  });

  const branchAccounts = Object.values(byBranch).sort((a, b) => a.branchName.localeCompare(b.branchName));
  const consolidated = {
    totalIncome: branchAccounts.reduce((s, b) => s + b.income, 0),
    totalExpense: branchAccounts.reduce((s, b) => s + b.expense, 0),
    totalNet: branchAccounts.reduce((s, b) => s + b.net, 0)
  };

  return NextResponse.json({
    ok: true,
    branches: branchAccounts,
    consolidated,
    availableBranches: branches.map((b) => ({ id: b.id, name: b.name }))
  });
}
