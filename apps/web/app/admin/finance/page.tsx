"use client";

import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";
import {
  AlertCircle,
  BellRing,
  Download,
  FileText,
  IndianRupee,
  Plus,
  ReceiptIndianRupee,
  RefreshCw,
  Send,
  Tag,
  TrendingDown,
  TrendingUp,
  Wallet
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
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

const kpis = [
  { label: "Total Income", value: "₹78.45L", delta: "+12.4%", tone: "bg-[#edf7ff] text-[#246bfe]", icon: TrendingUp },
  { label: "Total Expense", value: "₹36.75L", delta: "+4.8%", tone: "bg-[#fff3e8] text-[#c96a10]", icon: TrendingDown },
  { label: "Net Balance", value: "₹41.70L", delta: "+18.2%", tone: "bg-[#edfdf4] text-[#0a9255]", icon: Wallet },
  { label: "Outstanding Dues", value: "₹36.75L", delta: "318 students", tone: "bg-[#f1edff] text-[#6547d2]", icon: AlertCircle }
];

const feeCollection = [
  { name: "Collected", value: 78.45, label: "₹78.45L", color: "#4f63f6" },
  { name: "Pending", value: 24.55, label: "₹36.75L", color: "#9b7cff" },
  { name: "Overdue", value: 12.3, label: "₹12.30L", color: "#f97373" }
];

const bars = [
  { name: "Week 1", income: 18.6, expense: 8.4 },
  { name: "Week 2", income: 21.2, expense: 9.7 },
  { name: "Week 3", income: 17.8, expense: 7.9 },
  { name: "Week 4", income: 20.85, expense: 10.75 }
];

const transactions = [
  { date: "30 Jun", type: "Income", description: "Class 10 tuition collection", category: "Fees", amount: "+₹6.25L", status: "Completed" },
  { date: "29 Jun", type: "Expense", description: "Science lab equipment", category: "Academic", amount: "-₹1.40L", status: "Approved" },
  { date: "28 Jun", type: "Income", description: "Transport fee receipts", category: "Transport", amount: "+₹2.18L", status: "Completed" },
  { date: "27 Jun", type: "Expense", description: "Campus maintenance work", category: "Operations", amount: "-₹86,000", status: "Pending" },
  { date: "26 Jun", type: "Income", description: "Annual enrollment payments", category: "Admissions", amount: "+₹4.72L", status: "Completed" }
];

const actions = [
  { label: "Collect Fee", href: "/admin/payments", icon: ReceiptIndianRupee },
  { label: "Add Expense", href: "/admin/finance/expenses", icon: Plus },
  { label: "Send Reminder", href: "/admin/finance/reminders", icon: Send },
  { label: "Generate Invoice", href: "/admin/finance/invoices", icon: FileText },
  { label: "Add Concession", href: "/admin/fee-concessions", icon: Tag },
  { label: "Export Report", href: "/admin/fee-reports", icon: Download }
];

export default function FinanceDashboardPage() {
  const { role } = useAdminSession();

  if (!hasPermission(role, "fees.view")) {
    return (
      <section className="p-4 md:p-7">
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
            <AlertCircle size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">Your role cannot view finance.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-full bg-[#f6f8ff] p-4 md:p-6 xl:p-7">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col gap-4 rounded-2xl border border-[#e3e8f6] bg-white px-5 py-4 shadow-[0_14px_38px_rgba(31,41,100,0.07)] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#171931] md:text-[28px]">Fees & Finance Dashboard</h1>
            <p className="mt-1 text-sm font-semibold text-[#7d86a8]">Tuesday, June 30, 2026 • Academic Year 2026–27</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className="field h-10 w-[168px] py-0 text-sm" defaultValue="2026-27" aria-label="Academic year">
              <option value="2026-27">AY 2026–27</option>
              <option value="2025-26">AY 2025–26</option>
            </select>
            <select className="field h-10 w-[142px] py-0 text-sm" defaultValue="month" aria-label="Time range">
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
            <IconButton label="Refresh"><RefreshCw size={18} /></IconButton>
            <IconButton label="Notifications"><BellRing size={18} /></IconButton>
            <IconButton label="Download"><Download size={18} /></IconButton>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {kpis.map(({ label, value, delta, tone, icon: Icon }) => (
            <article key={label} className="rounded-2xl border border-[#e3e8f6] bg-white p-5 shadow-[0_12px_30px_rgba(31,41,100,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.08em] text-[#8a94b6]">{label}</p>
                  <p className="mt-2 text-[28px] font-extrabold tracking-tight text-[#171931]">{value}</p>
                </div>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}>
                  <Icon size={20} />
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-[#7d86a8]">{delta}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
          <article className="rounded-2xl border border-[#e3e8f6] bg-white p-5 shadow-[0_12px_30px_rgba(31,41,100,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-[#171931]">Fee Collection Overview</h2>
                <p className="mt-1 text-xs font-semibold text-[#8a94b6]">Total target: ₹115.30L</p>
              </div>
              <span className="rounded-full bg-[#eef0ff] px-3 py-1 text-xs font-extrabold text-[#3033a1]">This Month</span>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr] md:items-center">
              <div className="relative h-[220px]">
                <ResponsiveContainerAny width="100%" height="100%">
                  <PieChartAny>
                    <PieAny data={feeCollection} dataKey="value" innerRadius={64} outerRadius={96} paddingAngle={4} stroke="none">
                      {feeCollection.map((item) => (
                        <CellAny key={item.name} fill={item.color} />
                      ))}
                    </PieAny>
                    <TooltipAny formatter={(value: number) => [`₹${Number(value).toFixed(2)}L`, "Amount"]} />
                  </PieChartAny>
                </ResponsiveContainerAny>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-xs font-bold text-[#8a94b6]">Collected</p>
                    <p className="text-2xl font-extrabold text-[#171931]">68%</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {feeCollection.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-[#f7f9ff] px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm font-bold text-[#303247]">{item.name}</span>
                    </div>
                    <span className="text-sm font-extrabold text-[#171931]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-[#e3e8f6] bg-white p-5 shadow-[0_12px_30px_rgba(31,41,100,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-[#171931]">Income vs Expense</h2>
                <p className="mt-1 text-xs font-semibold text-[#8a94b6]">Weekly movement for June 2026</p>
              </div>
              <div className="flex gap-3 text-xs font-bold text-[#7d86a8]">
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#4f63f6]" /> Income</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f97373]" /> Expense</span>
              </div>
            </div>
            <div className="mt-5 h-[300px]">
              <ResponsiveContainerAny width="100%" height="100%">
                <BarChartAny data={bars} barGap={8}>
                  <CartesianGridAny stroke="#edf1fb" vertical={false} />
                  <XAxisAny dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#7d86a8", fontSize: 12, fontWeight: 700 }} />
                  <YAxisAny axisLine={false} tickLine={false} tick={{ fill: "#9aa3bd", fontSize: 12 }} tickFormatter={(value: number) => `${value}L`} />
                  <TooltipAny formatter={(value: number) => `₹${Number(value).toFixed(2)}L`} cursor={{ fill: "#f6f8ff" }} />
                  <BarAny dataKey="income" fill="#4f63f6" radius={[8, 8, 0, 0]} maxBarSize={42} />
                  <BarAny dataKey="expense" fill="#f97373" radius={[8, 8, 0, 0]} maxBarSize={42} />
                </BarChartAny>
              </ResponsiveContainerAny>
            </div>
          </article>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
          <article className="overflow-hidden rounded-2xl border border-[#e3e8f6] bg-white shadow-[0_12px_30px_rgba(31,41,100,0.06)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#edf1fb] px-5 py-4">
              <div>
                <h2 className="text-base font-extrabold text-[#171931]">Recent Transactions</h2>
                <p className="mt-1 text-xs font-semibold text-[#8a94b6]">Latest fee, expense, and invoice activity</p>
              </div>
              <Link href="/admin/finance/ledger" className="text-sm font-extrabold text-[#3033a1] hover:underline">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
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
                  {transactions.map((tx) => (
                    <tr key={`${tx.date}-${tx.description}`} className="border-t border-[#edf1fb]">
                      <td className="px-5 py-4 font-semibold text-[#65708f]">{tx.date}</td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${tx.type === "Income" ? "bg-[#edfdf4] text-[#0a9255]" : "bg-[#fff1f1] text-[#d84d5b]"}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-bold text-[#303247]">{tx.description}</td>
                      <td className="px-5 py-4 text-[#65708f]">{tx.category}</td>
                      <td className={`px-5 py-4 text-right font-extrabold ${tx.amount.startsWith("+") ? "text-[#0a9255]" : "text-[#d84d5b]"}`}>{tx.amount}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-extrabold text-[#3033a1]">{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl border border-[#e3e8f6] bg-white p-5 shadow-[0_12px_30px_rgba(31,41,100,0.06)]">
            <h2 className="text-base font-extrabold text-[#171931]">Quick Actions</h2>
            <div className="mt-4 grid gap-3">
              {actions.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex h-12 items-center gap-3 rounded-xl border border-[#e5e9f7] bg-[#f9fbff] px-3 text-sm font-extrabold text-[#303247] transition hover:border-[#cfd6ff] hover:bg-white hover:text-[#3033a1] hover:shadow-[0_10px_22px_rgba(44,48,143,0.08)]"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#eef0ff] text-[#3033a1]">
                    <Icon size={16} />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-[#17217f] p-4 text-white shadow-[0_14px_28px_rgba(23,33,127,0.20)]">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/12">
                  <IndianRupee size={19} />
                </span>
                <div>
                  <p className="text-sm font-extrabold">Today</p>
                  <p className="text-xs font-semibold text-[#c7d0ff]">₹8.43L collected</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function IconButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="grid h-10 w-10 place-items-center rounded-xl border border-[#e3e8f6] bg-[#f8faff] text-[#3033a1] transition hover:bg-white hover:shadow-[0_8px_18px_rgba(44,48,143,0.10)]"
    >
      {children}
    </button>
  );
}
