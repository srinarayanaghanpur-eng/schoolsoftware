"use client";

import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import {
  AlertCircle,
  BellRing,
  Circle,
  Download,
  FileText,
  IndianRupee,
  Plus,
  ReceiptIndianRupee,
  RefreshCw,
  Send,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const ResponsiveContainerAny = ResponsiveContainer as unknown as ComponentType<any>;
const PieChartAny = PieChart as unknown as ComponentType<any>;
const PieAny = Pie as unknown as ComponentType<any>;
const CellAny = Cell as unknown as ComponentType<any>;
const BarChartAny = BarChart as unknown as ComponentType<any>;
const BarAny = Bar as unknown as ComponentType<any>;
const CartesianGridAny = CartesianGrid as unknown as ComponentType<any>;
const XAxisAny = XAxis as unknown as ComponentType<any>;
const YAxisAny = YAxis as unknown as ComponentType<any>;
const TooltipAny = Tooltip as unknown as ComponentType<any>;

const TRANSACTIONS_PER_PAGE = 25;

const chartLabelColor = "hsl(var(--chart-label))";
const chartGridColor = "hsl(var(--chart-grid))";
const chartTooltipStyle = {
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  background: "hsl(var(--chart-tooltip))",
  color: "hsl(var(--chart-tooltip-foreground))",
  boxShadow: "0 14px 34px rgb(0 0 0 / 0.18)"
};
const chartTooltipTextStyle = { color: "hsl(var(--chart-tooltip-foreground))" };
const chartCursorFill = "hsl(var(--muted) / 0.72)";

const actions = [
  { label: "Collect Fee", href: "/admin/payments", icon: ReceiptIndianRupee },
  { label: "Add Expense", href: "/admin/finance/expenses", icon: Plus },
  { label: "Send Reminder", href: "/admin/finance/reminders", icon: Send },
  { label: "Generate Invoice", href: "/admin/finance/invoices", icon: FileText },
  { label: "Export Report", href: "/admin/fee-reports", icon: Download }
];

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
  };
  feeCollection: Array<{ name: string; value: number; percent: number; label: string; color: string }>;
  collectionTarget: number;
  bars: Array<{ name: string; income: number; expense: number; incomeLakhs: number; expenseLakhs: number }>;
  transactions: Array<{
    date: string;
    type: "Income" | "Expense";
    description: string;
    category: string;
    amount: number;
    status: string;
  }>;
};

function dateKey(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function rangeForMode(mode: RangeMode) {
  const now = new Date();
  if (mode === "year") {
    return {
      from: dateKey(new Date(now.getFullYear(), 0, 1)),
      to: dateKey(new Date(now.getFullYear(), 11, 31))
    };
  }
  if (mode === "quarter") {
    const quarterStart = Math.floor(now.getMonth() / 3) * 3;
    return {
      from: dateKey(new Date(now.getFullYear(), quarterStart, 1)),
      to: dateKey(new Date(now.getFullYear(), quarterStart + 3, 0))
    };
  }
  return {
    from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: dateKey(new Date(now.getFullYear(), now.getMonth() + 1, 0))
  };
}

function formatINR(amount: number) {
  if (Math.abs(amount) >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (Math.abs(amount) >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  if (!value) return "--";
  try {
    const d = new Date(value + (value.includes("T") ? "" : "T00:00:00"));
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return value;
  }
}

function formatRange(from: string, to: string) {
  return `${formatDate(from)} - ${formatDate(to)}`;
}

export default function FinanceDashboardPage() {
  const { role } = useAdminSession();
  const [rangeMode, setRangeMode] = useState<RangeMode>("month");
  const [data, setData] = useState<FinanceDashboardPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionPage, setTransactionPage] = useState(1);

  const range = useMemo(() => rangeForMode(rangeMode), [rangeMode]);
  const feeCollection = data?.feeCollection ?? [];
  const bars = data?.bars ?? [];
  const transactions = data?.transactions ?? [];
  const transactionPageCount = Math.max(1, Math.ceil(transactions.length / TRANSACTIONS_PER_PAGE));
  const currentTransactionPage = Math.min(transactionPage, transactionPageCount);
  const transactionStart = (currentTransactionPage - 1) * TRANSACTIONS_PER_PAGE;
  const pagedTransactions = transactions.slice(transactionStart, transactionStart + TRANSACTIONS_PER_PAGE);
  const collectedPercent = feeCollection.find((item) => item.name === "Collected")?.percent ?? 0;
  const targetLabel = formatINR(data?.collectionTarget ?? 0);

  const kpis = useMemo(() => {
    const values = data?.kpis;
    return [
      { label: "Total Income", value: formatINR(values?.totalIncome ?? 0), delta: "Fees and other income", tone: "bg-[#edf7ff] text-[#246bfe] dark:bg-blue-500/15 dark:text-blue-300", icon: TrendingUp },
      { label: "Total Expense", value: formatINR(values?.totalExpense ?? 0), delta: "Approved expenses, salary, advances", tone: "bg-[#fff3e8] text-[#c96a10] dark:bg-yellow-400/15 dark:text-yellow-300", icon: TrendingDown },
      { label: "Net Balance", value: formatINR(values?.netBalance ?? 0), delta: values && values.netBalance >= 0 ? "Surplus for selected range" : "Deficit for selected range", tone: "bg-[#edfdf4] text-[#0a9255] dark:bg-emerald-500/15 dark:text-emerald-300", icon: Wallet },
      { label: "Outstanding Dues", value: formatINR(values?.outstandingDues ?? 0), delta: `${values?.studentsPending ?? 0} pending student${values?.studentsPending === 1 ? "" : "s"}`, tone: "bg-[#f1edff] text-[#6547d2] dark:bg-indigo-500/15 dark:text-indigo-200", icon: AlertCircle }
    ];
  }, [data]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<FinanceDashboardPayload>(
        `/api/admin/finance/dashboard?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      );
      setData(result);
      setTransactionPage(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load finance dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hasPermission(role, "fees.view")) return;
    void loadDashboard();
  }, [role, range.from, range.to]);

  const exportTransactions = () => {
    if (!transactions.length) return;
    const rows = [
      ["Date", "Type", "Description", "Category", "Amount", "Status"],
      ...transactions.map((tx) => [tx.date, tx.type, tx.description, tx.category, String(tx.amount), tx.status])
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
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b] dark:bg-rose-500/15 dark:text-rose-300">
            <AlertCircle size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-foreground dark:text-white">Access denied</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">Your role cannot view finance.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-full bg-background p-4 md:p-6 xl:p-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4 text-card-foreground shadow-[0_14px_38px_rgba(31,41,100,0.07)] dark:bg-slate-900 dark:shadow-black/20 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground dark:text-white md:text-[28px]">Fees & Finance Dashboard</h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">{formatRange(range.from, range.to)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field h-10 w-[142px] py-0 text-sm" value={rangeMode} onChange={(event) => setRangeMode(event.target.value as RangeMode)} aria-label="Time range">
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <IconButton label="Refresh" onClick={loadDashboard} disabled={loading}><RefreshCw size={18} /></IconButton>
            <IconButton label="Notifications"><BellRing size={18} /></IconButton>
            <IconButton label="Download" onClick={exportTransactions} disabled={!transactions.length}><Download size={18} /></IconButton>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive dark:text-rose-300">
            {error}
          </div>
        )}

        <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-[0_12px_30px_rgba(31,41,100,0.06)] dark:bg-slate-900 dark:shadow-black/20">
          <h2 className="text-base font-extrabold text-foreground dark:text-slate-100">Quick Actions</h2>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">Common finance workflows in one tap.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {actions.filter(Boolean).map(({ label, href, icon }) => {
              const Icon = icon ?? Circle;
              return (
                <Link
                  key={label}
                  href={href}
                  className="group flex min-w-[92px] flex-col items-center gap-2 rounded-lg px-2 py-2 text-center transition hover:bg-muted"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-accent-foreground transition group-hover:scale-105 dark:bg-indigo-500/15 dark:text-indigo-200">
                    <Icon size={21} strokeWidth={2.3} />
                  </span>
                  <span className="text-xs font-extrabold leading-4 text-foreground">{label}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-5 rounded-xl bg-[#17217f] p-4 text-white shadow-[0_14px_28px_rgba(23,33,127,0.20)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/12">
                <IndianRupee size={19} />
              </span>
              <div>
                <p className="text-sm font-extrabold">Today</p>
                <p className="text-xs font-semibold text-[#c7d0ff]">{formatINR(data?.kpis.todayCollected ?? 0)} collected</p>
              </div>
            </div>
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.filter(Boolean).map(({ label, value, delta, tone, icon }) => {
            const Icon = icon ?? Circle;
            return (
              <article key={label} className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-[0_12px_30px_rgba(31,41,100,0.06)] dark:bg-slate-900 dark:shadow-black/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                    <p className="mt-2 text-[28px] font-extrabold tracking-tight text-foreground dark:text-white">{value}</p>
                  </div>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
                    <Icon size={20} />
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-muted-foreground">{delta}</p>
              </article>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-[0_12px_30px_rgba(31,41,100,0.06)] dark:bg-slate-900 dark:shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-foreground dark:text-slate-100">Fee Collection Overview</h2>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Total target: {targetLabel}</p>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-accent-foreground dark:bg-indigo-500/15 dark:text-indigo-200">{loading ? "Syncing" : "Live"}</span>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
              <div className="relative h-[220px] min-h-[220px] w-full">
                {feeCollection.length > 0 ? (
                  <>
                    <ResponsiveContainerAny width="100%" height="100%">
                      <PieChartAny>
                        <PieAny data={feeCollection} dataKey="value" innerRadius={64} outerRadius={96} paddingAngle={4} stroke="none">
                          {feeCollection.map((item) => (
                            <CellAny key={item.name} fill={item.color} />
                          ))}
                        </PieAny>
                        <TooltipAny formatter={(value: number) => [formatINR(Number(value)), "Amount"]} contentStyle={chartTooltipStyle} labelStyle={chartTooltipTextStyle} itemStyle={chartTooltipTextStyle} />
                      </PieChartAny>
                    </ResponsiveContainerAny>
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground">Collected</p>
                        <p className="text-2xl font-extrabold text-foreground dark:text-white">{collectedPercent}%</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid h-full place-items-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                    No data available yet
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {feeCollection.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-bold text-foreground dark:text-white">{item.name}</span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground dark:text-white">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-[0_12px_30px_rgba(31,41,100,0.06)] dark:bg-slate-900 dark:shadow-black/20">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-foreground dark:text-slate-100">Income vs Expense</h2>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Weekly movement for selected range</p>
              </div>
              <div className="flex gap-3 text-xs font-bold text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#4f63f6]" /> Income</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f97373]" /> Expense</span>
              </div>
            </div>
            <div className="mt-5 h-[300px] min-h-[300px] w-full">
              {bars.length > 0 ? (
                <ResponsiveContainerAny width="100%" height="100%">
                  <BarChartAny data={bars} barGap={8}>
                    <CartesianGridAny stroke={chartGridColor} vertical={false} />
                    <XAxisAny dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartLabelColor, fontSize: 12, fontWeight: 700 }} />
                    <YAxisAny axisLine={false} tickLine={false} tick={{ fill: chartLabelColor, fontSize: 12 }} tickFormatter={(value: number) => `${value}L`} />
                    <TooltipAny formatter={(value: number) => `₹${Number(value).toFixed(2)}L`} cursor={{ fill: chartCursorFill }} contentStyle={chartTooltipStyle} labelStyle={chartTooltipTextStyle} itemStyle={chartTooltipTextStyle} />
                    <BarAny dataKey="incomeLakhs" fill="#4f63f6" radius={[8, 8, 0, 0]} maxBarSize={42} name="Income" />
                    <BarAny dataKey="expenseLakhs" fill="#f97373" radius={[8, 8, 0, 0]} maxBarSize={42} name="Expense" />
                  </BarChartAny>
                </ResponsiveContainerAny>
              ) : (
                <div className="grid h-full place-items-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground">
                  No data available yet
                </div>
              )}
            </div>
          </article>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <article className="rounded-2xl border border-border bg-card text-card-foreground shadow-[0_12px_30px_rgba(31,41,100,0.06)] dark:bg-slate-900 dark:shadow-black/20">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-extrabold text-foreground dark:text-slate-100">Recent Transactions</h2>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">Latest fee, expense, and invoice activity</p>
              </div>
              <Link href="/admin/finance/ledger" className="text-sm font-extrabold text-accent-number hover:underline">View all</Link>
            </div>
            {/* Desktop table: horizontal scroll if needed */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Description</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTransactions.map((tx, index) => (
                    <tr key={`${transactionStart + index}-${tx.date}-${tx.type}-${tx.description}-${tx.amount}`} className="border-t border-border">
                      <td className="px-5 py-4 font-semibold text-muted-foreground">{formatDate(tx.date)}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${tx.type === "Income" ? "bg-[#edfdf4] text-[#0a9255] dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-[#fff1f1] text-[#d84d5b] dark:bg-rose-500/15 dark:text-rose-300"}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground dark:text-white">{tx.description}</td>
                      <td className="px-5 py-4 text-muted-foreground">{tx.category}</td>
                      <td className={`px-5 py-4 text-right font-extrabold ${tx.type === "Income" ? "text-success dark:text-emerald-300" : "text-destructive dark:text-rose-300"}`}>
                        {tx.type === "Income" ? "+" : "-"}{formatINR(tx.amount)}
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-extrabold text-accent-foreground dark:bg-indigo-500/15 dark:text-indigo-200">{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile/tablet: stacked transaction cards */}
            <div className="md:hidden divide-y divide-border">
              {pagedTransactions.length > 0 ? pagedTransactions.map((tx, index) => (
                <div key={`mobile-${transactionStart + index}-${tx.date}-${tx.type}`} className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{formatDate(tx.date)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${tx.type === "Income" ? "bg-[#edfdf4] text-[#0a9255]" : "bg-[#fff1f1] text-[#d84d5b]"}`}>
                      {tx.type}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground dark:text-white">{tx.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{tx.category}</span>
                    <span className={`text-sm font-extrabold ${tx.type === "Income" ? "text-success" : "text-destructive"}`}>
                      {tx.type === "Income" ? "+" : "-"}{formatINR(tx.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-accent-foreground">{tx.status}</span>
                  </div>
                </div>
              )) : (
                <div className="px-5 py-8 text-center text-sm font-semibold text-muted-foreground">
                  {loading ? "Loading transactions..." : "No transactions for this range."}
                </div>
              )}
            </div>
            {/* Loading skeleton shown only during first load when no transactions exist */}
            {loading && transactions.length === 0 && (
              <div className="hidden md:block">
                {[1,2,3].map((i) => (
                  <div key={`skeleton-${i}`} className="flex items-center gap-4 border-t border-border px-5 py-4 animate-pulse">
                    <div className="h-4 w-20 rounded bg-muted" />
                    <div className="h-6 w-16 rounded-full bg-muted" />
                    <div className="h-4 flex-1 rounded bg-muted" />
                    <div className="h-4 w-16 rounded bg-muted" />
                    <div className="h-4 w-20 rounded bg-muted" />
                    <div className="h-6 w-16 rounded-full bg-muted" />
                  </div>
                ))}
              </div>
            )}
            {transactions.length > TRANSACTIONS_PER_PAGE && (
              <div className="flex flex-col gap-3 border-t border-border px-5 py-4 text-sm font-bold text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {transactionStart + 1}-{Math.min(transactionStart + TRANSACTIONS_PER_PAGE, transactions.length)} of {transactions.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl border border-border bg-muted px-3 py-2 text-xs font-extrabold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={currentTransactionPage <= 1}
                    onClick={() => setTransactionPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </button>
                  <span className="px-2 text-xs font-extrabold">
                    Page {currentTransactionPage} of {transactionPageCount}
                  </span>
                  <button
                    type="button"
                    className="rounded-xl border border-border bg-muted px-3 py-2 text-xs font-extrabold text-foreground transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={currentTransactionPage >= transactionPageCount}
                    onClick={() => setTransactionPage((page) => Math.min(transactionPageCount, page + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </article>

        </div>
      </div>
    </section>
  );
}

function IconButton({
  label,
  children,
  disabled = false,
  onClick
}: {
  label: string;
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-muted text-accent-number transition hover:bg-card hover:shadow-[0_8px_18px_rgba(44,48,143,0.10)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
