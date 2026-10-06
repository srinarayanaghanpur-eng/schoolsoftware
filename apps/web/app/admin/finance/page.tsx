"use client";

import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { formatLabel, hasPermission } from "@sri-narayana/shared";
import {
  AlertCircle,
  ArrowUpRight,
  Banknote,
  BookOpen,
  ClipboardList,
  CreditCard,
  Download,
  FileText,
  HandCoins,
  IndianRupee,
  Landmark,
  LucideIcon,
  Printer,
  Receipt,
  ReceiptIndianRupee,
  RefreshCw,
  Send,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AmountText, formatINR, formatSafeDate, formatPersonName, MethodBadge, StatusBadge, TypeBadge } from "@/components/finance";
import { FinanceActionBar } from "@/components/finance/FinanceActionBar";
import { FinanceEmptyState } from "@/components/finance/FinanceEmptyState";
import { FinanceShell } from "@/components/finance/FinanceShell";
import { FinanceStatCard } from "@/components/finance/FinanceStatCard";
import { FinanceTabs, FINANCE_TABS } from "@/components/finance/FinanceTabs";
import { ResponsiveFinanceTable } from "@/components/finance/ResponsiveFinanceTable";

type RangeMode = "month" | "quarter" | "year";

type FinanceDashboardPayload = {
  ok: true;
  range: { from: string; to: string };
  kpis: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    outstandingDues: number;
    studentsPending: number;
    todayCollected: number;
    paymentCount: number;
    monthCollected?: number;
    pendingTransfers?: number;
  };
  feeCollection: Array<{ label: string; value: number; percent?: number; color: string }>;
  collectionTarget: number;
  bars: Array<{ name: string; incomeLakhs: number; expenseLakhs: number }>;
  transactions: Array<{
    date: string;
    type: string;
    description: string;
    category: string;
    amount: number;
    status: string;
    studentName?: string;
    method?: string;
  }>;
  duesByClass?: Array<{ className: string; total: number; dueCount: number; dueAmount: number }>;
  expenseBreakdown?: Array<{ category: string; amount: number }>;
  collectionByMethod?: Array<{ method: string; amount: number }>;
};

function dateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function rangeForMode(mode: RangeMode) {
  const now = new Date();
  if (mode === "year") {
    return {
      from: dateKey(new Date(now.getFullYear(), 0, 1)),
      to: dateKey(new Date(now.getFullYear(), 11, 31)),
    };
  }
  if (mode === "quarter") {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    return {
      from: dateKey(new Date(now.getFullYear(), quarterStart, 1)),
      to: dateKey(new Date(now.getFullYear(), quarterStart + 3, 0)),
    };
  }
  return {
    from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export default function FinanceDashboardPage() {
  const { role } = useAdminSession();
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState<FinanceDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => rangeForMode(rangeMode), [rangeMode]);
  const transactions = data?.transactions ?? [];
  const kpis = data?.kpis;

  const loadDashboard = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<FinanceDashboardPayload>(
        `/api/admin/finance/dashboard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}${forceRefresh ? "&refresh=1" : ""}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load finance data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    if (!hasPermission(role, "fees.view")) return;
    void loadDashboard();
  }, [loadDashboard, role]);

  const exportTransactions = () => {
    if (!transactions.length) return;
    const rows = [
      ["Date", "Type", "Description", "Category", "Amount", "Status"],
      ...transactions.map((tx) => [tx.date, tx.type, tx.description, tx.category, String(tx.amount), tx.status]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finance-dashboard-${range.from}-${range.to}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  if (!hasPermission(role, "fees.view")) {
    return (
      <section className="p-4 md:p-7">
        <div className="flex max-w-2xl items-start gap-4 rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fef2f2] text-[#dc2626]">
            <AlertCircle size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[#1e293b]">Access Denied</h2>
            <p className="mt-1 text-sm font-medium text-[#64748b]">Your role does not have permission to view finance data.</p>
          </div>
        </div>
      </section>
    );
  }

  const summaryCards = [
    { icon: <TrendingUp size={20} />, label: "Today Collection", value: formatINR(kpis?.todayCollected ?? 0), subtext: "Fee collected today", bgClass: "bg-[#eff6ff]" },
    { icon: <IndianRupee size={20} />, label: "Month Collection", value: formatINR(kpis?.monthCollected ?? kpis?.totalIncome ?? 0), subtext: `${kpis?.paymentCount ?? 0} payments`, bgClass: "bg-[#f0fdf4]" },
    { icon: <AlertCircle size={20} />, label: "Total Due", value: formatINR(kpis?.outstandingDues ?? 0), subtext: `${kpis?.studentsPending ?? 0} students pending`, bgClass: "bg-[#fefce8]" },
    { icon: <TrendingDown size={20} />, label: "Total Expense", value: formatINR(kpis?.totalExpense ?? 0), subtext: "Approved & pending expenses", bgClass: "bg-[#fef2f2]" },
    { icon: <Wallet size={20} />, label: "Net Balance", value: formatINR(kpis?.netBalance ?? 0), subtext: (kpis?.netBalance ?? 0) >= 0 ? "Positive balance" : "Deficit", bgClass: "bg-[#f0fdf4]" },
    { icon: <Landmark size={20} />, label: "Pending Transfers", value: String(kpis?.pendingTransfers ?? 0), subtext: "Bank transfers to verify", bgClass: "bg-[#faf5ff]" },
  ];

  const quickActions = [
    { label: "Collect Fee", icon: <ReceiptIndianRupee size={17} />, onClick: () => { setActiveTab("collection"); }, primary: true },
    { label: "Add Expense", icon: <TrendingDown size={17} />, onClick: () => { window.location.href = "/admin/finance/expenses"; } },
    { label: "Add Concession", icon: <HandCoins size={17} />, onClick: () => { window.location.href = "/admin/students"; } },
    { label: "Send Reminder", icon: <Send size={17} />, onClick: () => { window.location.href = "/admin/finance/reminders"; } },
    { label: "Print Receipt", icon: <Printer size={17} />, onClick: () => { window.location.href = "/admin/finance/receipts"; } },
    { label: "Export Excel", icon: <Download size={17} />, onClick: exportTransactions, disabled: !transactions.length },
  ];

  const transactionColumns = [
    { key: "date", header: "Date", cell: (r: typeof transactions[0]) => <span className="whitespace-nowrap text-xs font-semibold text-[#64748b]">{formatSafeDate(r.date)}</span> },
    { key: "type", header: "Type", cell: (r: typeof transactions[0]) => <TypeBadge type={r.type} /> },
    { key: "student", header: "Description", cell: (r: typeof transactions[0]) => (
      <div className="max-w-[200px]" title={r.description}>
        <span className="text-sm font-bold text-[#1e293b]">{r.studentName ? formatPersonName(r.studentName) : r.description}</span>
      </div>
    ), className: "max-w-[200px]" },
    { key: "method", header: "Method", cell: (r: typeof transactions[0]) => <MethodBadge method={r.category || r.method} />, hideOnMobile: true },
    { key: "amount", header: "Amount", align: "right" as const, cell: (r: typeof transactions[0]) => (
      <span className={`text-sm font-extrabold ${r.type === "Expense" ? "text-[#dc2626]" : "text-[#16a34a]"}`}>
        {r.type === "Expense" ? "−" : "+"}{formatINR(r.amount)}
      </span>
    ) },
    { key: "status", header: "Status", cell: (r: typeof transactions[0]) => <StatusBadge status={r.status} />, hideOnMobile: true },
    { key: "actions", header: "", align: "center" as const, cell: () => (
      <button className="rounded-lg p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#2563eb] transition-colors">
        <ArrowUpRight size={15} />
      </button>
    ) },
  ];

  const renderCardSkeleton = () => (
    <div className="space-y-2 animate-pulse" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-4 rounded-full bg-[#f1f5f9]" />
      ))}
    </div>
  );

  const renderCollectionMethodChart = () => {
    if (loading) return renderCardSkeleton();
    if (error && !data) return <p className="text-sm font-semibold text-[#dc2626]">Failed to load.</p>;
    const methods = data?.collectionByMethod ?? [];
    if (methods.length === 0) return <p className="text-sm text-[#94a3b8]">No data</p>;
    const total = methods.reduce((s, m) => s + m.amount, 0);
    return (
      <div className="space-y-2">
        {methods.map((m) => {
          const pct = total > 0 ? ((m.amount / total) * 100).toFixed(0) : 0;
          return (
            <div key={m.method} className="flex items-center gap-2">
              <span className="w-24 text-xs font-bold text-[#64748b]">{m.method === "upi" || m.method === "UPI" ? "UPI" : m.method.includes("/") ? m.method : formatLabel(m.method)}</span>
              <div className="flex-1 h-2 rounded-full bg-[#f1f5f9] overflow-hidden">
                <div className="h-full rounded-full bg-[#2563eb] transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-semibold text-[#1e293b] w-20 text-right">{formatINR(m.amount)}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDuesByClass = () => {
    if (loading) return renderCardSkeleton();
    if (error && !data) return <p className="text-sm font-semibold text-[#dc2626]">Failed to load.</p>;
    const classes = data?.duesByClass ?? [];
    if (classes.length === 0) return <p className="text-sm text-[#94a3b8]">No due data</p>;
    return (
      <div className="space-y-2">
        {classes.slice(0, 8).map((c) => (
          <div key={c.className} className="flex items-center justify-between rounded-xl bg-[#f8fafc] px-3 py-2">
            <span className="text-sm font-bold text-[#1e293b]">{formatLabel(c.className)}</span>
            <div className="text-right">
              <span className="text-sm font-extrabold text-[#dc2626]">{formatINR(c.dueAmount)}</span>
              <span className="ml-2 text-xs text-[#94a3b8]">({c.dueCount} due)</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderExpenseBreakdown = () => {
    if (loading) return renderCardSkeleton();
    if (error && !data) return <p className="text-sm font-semibold text-[#dc2626]">Failed to load.</p>;
    const breakdown = data?.expenseBreakdown ?? [];
    if (breakdown.length === 0) return <p className="text-sm text-[#94a3b8]">No expense data</p>;
    const colors = ["#2563eb", "#dc2626", "#d97706", "#16a34a", "#7c3aed", "#0891b2"];
    return (
      <div className="space-y-2">
        {breakdown.map((e, i) => (
          <div key={e.category} className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
            <span className="flex-1 text-xs font-bold text-[#64748b]">{formatLabel(e.category)}</span>
            <span className="text-xs font-extrabold text-[#1e293b]">{formatINR(e.amount)}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-2 min-w-0">
        <h3 className="mb-3 text-sm font-extrabold text-[#1e293b]">Recent Transactions</h3>
        <div className="min-w-0 overflow-hidden">
          <ResponsiveFinanceTable columns={transactionColumns} rows={transactions.slice(0, 10)} rowKey={(r, index) => `${r.date}-${r.description}-${r.amount}-${index}`} loading={loading} empty="No transactions for this range." />
        </div>
        {transactions.length > 10 && (
          <div className="mt-3 text-right">
            <Link href="/admin/finance/ledger" className="text-xs font-bold text-[#2563eb] hover:underline">View all transactions →</Link>
          </div>
        )}
      </div>
      <div className="xl:col-span-1 space-y-4 min-w-0">
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#64748b]">Collection by Method</h4>
          {renderCollectionMethodChart()}
        </div>
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#64748b]">Dues by Class</h4>
          {renderDuesByClass()}
        </div>
        <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
          <h4 className="mb-3 text-xs font-extrabold uppercase tracking-wide text-[#64748b]">Expense Breakdown</h4>
          {renderExpenseBreakdown()}
        </div>
      </div>
    </div>
  );

  const renderCollectionTab = () => (
    <div className="rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-sm">
      <h3 className="text-base font-extrabold text-[#1e293b]">Fee Collection</h3>
      <p className="mt-1 text-sm text-[#64748b]">Search student, view fee summary, and collect payment.</p>
      <div className="mt-5">
        <Link href="/admin/payments" className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#1d4ed8] transition-colors">
          <ReceiptIndianRupee size={17} />
          Go to Payment Page
        </Link>
      </div>
    </div>
  );

  const renderPaymentsTab = () => (
    <FinanceEmptyState
      icon={<CreditCard size={40} />}
      title="Payment History"
      description="View and manage all fee payments with filters."
      action={<Link href="/admin/payments" className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors"><ReceiptIndianRupee size={16} />View Payments</Link>}
    />
  );

  const renderDuesTab = () => {
    const classes = data?.duesByClass ?? [];
    return (
      <div>
        <h3 className="mb-4 text-sm font-extrabold text-[#1e293b]">Class-wise Dues</h3>
        {classes.length === 0 && !loading ? (
          <FinanceEmptyState icon={<Users size={40} />} title="No dues found" description="All students are up to date with fee payments." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {classes.map((c) => (
              <div key={c.className} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-sm font-extrabold text-[#1e293b]">{formatLabel(c.className)}</p>
                <p className="mt-3 text-2xl font-extrabold text-[#dc2626]">{formatINR(c.dueAmount)}</p>
                <p className="mt-1 text-xs text-[#64748b]">{c.dueCount} of {c.total} students due</p>
                <button className="mt-3 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-xs font-bold text-[#2563eb] hover:bg-[#f8fafc] transition-colors">View Details</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderExpensesTab = () => (
    <FinanceEmptyState
      icon={<FileText size={40} />}
      title="Expense Management"
      description="Track, approve, and manage all school expenses."
      action={<Link href="/admin/finance/expenses" className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors"><TrendingDown size={16} />Manage Expenses</Link>}
    />
  );

  const renderSettlementsTab = () => (
    <FinanceEmptyState
      icon={<ClipboardList size={40} />}
      title="Daily Settlements"
      description="Verify cash, UPI, and bank transfers for daily closing."
      action={<button className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors">Create Settlement</button>}
    />
  );

  const renderReceiptsTab = () => (
    <FinanceEmptyState
      icon={<Receipt size={40} />}
      title="Receipt Management"
      description="Search, reprint, or cancel receipts as needed."
      action={<Link href="/admin/finance/receipts" className="inline-flex items-center gap-2 rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors"><Receipt size={16} />Manage Receipts</Link>}
    />
  );

  const renderTransfersTab = () => (
    <FinanceEmptyState
      icon={<Banknote size={40} />}
      title="Bank Transfers"
      description="Verify and approve pending UTR / bank payments."
      action={<button className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-bold text-white hover:bg-[#1d4ed8] transition-colors">Refresh Transfers</button>}
    />
  );

  const renderReportsTab = () => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { icon: <FileText size={20} />, title: "Daily Collection Report", desc: "Day-wise fee collection summary" },
        { icon: <BookOpen size={20} />, title: "Class-wise Collection", desc: "Fee collection grouped by class" },
        { icon: <Users size={20} />, title: "Student-wise Ledger", desc: "Individual student fee ledger" },
        { icon: <AlertCircle size={20} />, title: "Dues Report", desc: "All pending fee dues" },
        { icon: <TrendingDown size={20} />, title: "Defaulters Report", desc: "Students with overdue fees" },
        { icon: <FileText size={20} />, title: "Expense Report", desc: "Category-wise expense breakdown" },
        { icon: <Wallet size={20} />, title: "Cash Book", desc: "Daily cash inflow & outflow" },
        { icon: <TrendingUp size={20} />, title: "Profit & Loss", desc: "Income vs expense summary" },
        { icon: <CreditCard size={20} />, title: "Trial Balance", desc: "Accounts trial balance" },
      ].map((r) => (
        <div key={r.title} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm hover:shadow-md transition-all cursor-pointer">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#eff6ff] text-[#2563eb]">{r.icon}</span>
            <div>
              <p className="text-sm font-extrabold text-[#1e293b]">{r.title}</p>
              <p className="text-xs text-[#64748b]">{r.desc}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const tabContent: Record<string, () => React.ReactNode> = {
    overview: renderOverview,
    collection: renderCollectionTab,
    payments: renderPaymentsTab,
    dues: renderDuesTab,
    expenses: renderExpensesTab,
    settlements: renderSettlementsTab,
    receipts: renderReceiptsTab,
    transfers: renderTransfersTab,
    reports: renderReportsTab,
  };

  return (
    <FinanceShell
      title="Fees & Finance"
      description="Manage fee collection, dues, expenses, receipts, and reports."
      action={
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-xl border border-[#e2e8f0] bg-white px-3 text-xs font-bold text-[#1e293b]"
            value={rangeMode}
            onChange={(e) => setRangeMode(e.target.value as RangeMode)}
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
          <button
            onClick={() => void loadDashboard(true)}
            disabled={loading}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={exportTransactions}
            disabled={!transactions.length}
            className="grid h-9 w-9 place-items-center rounded-xl border border-[#e2e8f0] bg-white text-[#64748b] hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
          >
            <Download size={16} />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 auto-rows-fr [&>*]:h-full">
        {summaryCards.map((card) => (
          <FinanceStatCard key={card.label} {...card} />
        ))}
      </div>

      <FinanceActionBar actions={quickActions} />

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#dc2626]">
          <AlertCircle size={17} />
          <span className="flex-1">{error}</span>
          <button onClick={() => void loadDashboard(true)} className="rounded-lg border border-[#fecaca] px-3 py-1 text-xs font-bold hover:bg-[#fee2e2] transition-colors">Retry</button>
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center rounded-2xl border border-[#e2e8f0] bg-white p-12">
          <div className="flex items-center gap-3 text-[#64748b]">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm font-bold">Loading finance data...</span>
          </div>
        </div>
      )}

      {data && (
        <>
          <FinanceTabs tabs={FINANCE_TABS} active={activeTab} onChange={setActiveTab} />
          <div className="mt-2">
            {tabContent[activeTab]?.() ?? renderOverview()}
          </div>
        </>
      )}
    </FinanceShell>
  );
}
