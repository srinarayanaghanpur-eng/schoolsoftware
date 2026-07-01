"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Building2,
  CalendarClock,
  FileMinus,
  FileText,
  Landmark,
  Layers,
  Receipt,
  ReceiptIndianRupee,
  ScrollText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/* ---------- response types (match the existing finance API routes) ---------- */
type Summary = {
  income: { fees: number; other: number; total: number };
  expense: { general: number; salary: number; advances: number; total: number };
  net: number;
};
type Dues = { classes: { className: string; studentCount: number; totalDue: number }[]; grandTotalDue: number; studentsWithDues: number };
type Ledger = { entries: { date: string; type: "income" | "expense"; category: string; description: string; amount: number; balance: number }[]; closingBalance: number };
type CashBook = { closingBalance: number };
type BankAccounts = { accounts: { currentBalance?: number; bankName?: string }[] };
type DeletedBills = { bills: { id: string; type: string; category: string; amount: number; date: string; description: string; deletedBy?: string; reason?: string }[]; count: number };

function inr(n: number) {
  return `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Percent change vs a previous period; null when there's no comparable base (so we never invent a delta). */
function pct(cur: number, prev: number): number | null {
  if (!prev || prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

export default function FinanceDashboardPage() {
  const { role } = useAdminSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [data, setData] = useState<{
    todayColl: number; yestColl: number;
    monthColl: number; lastMonthColl: number;
    monthExp: number; lastMonthExp: number;
    dues: Dues | null;
    cashInHand: number | null;
    bankBalance: number | null;
    cancelledTotal: number; cancelledCount: number;
    ledger: Ledger | null;
    bills: DeletedBills["bills"];
    net: number;
  } | null>(null);

  useEffect(() => {
    if (!hasPermission(role, "fees.view")) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      const now = new Date();
      const todayStr = iso(now);
      const yest = new Date(now); yest.setDate(now.getDate() - 1);
      const yestStr = iso(yest);
      const monthStart = iso(new Date(now.getFullYear(), now.getMonth(), 1));
      const lastMonthStart = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      const lastMonthEnd = iso(new Date(now.getFullYear(), now.getMonth(), 0));

      const q = (path: string) => adminApiRequest<{ summary: Summary }>(path);

      const results = await Promise.allSettled([
        q(`/api/admin/finance/summary?from=${todayStr}&to=${todayStr}`),       // 0 today
        q(`/api/admin/finance/summary?from=${yestStr}&to=${yestStr}`),         // 1 yesterday
        q(`/api/admin/finance/summary?from=${monthStart}&to=${todayStr}`),     // 2 this month
        q(`/api/admin/finance/summary?from=${lastMonthStart}&to=${lastMonthEnd}`), // 3 last month
        adminApiRequest<Dues>("/api/admin/finance/dues"),                      // 4
        adminApiRequest<CashBook>("/api/admin/finance/cash-book"),             // 5
        adminApiRequest<BankAccounts>("/api/admin/finance/bank-accounts"),     // 6
        adminApiRequest<DeletedBills>("/api/admin/finance/deleted-bills"),     // 7
        adminApiRequest<Ledger>("/api/admin/finance/ledger"),                  // 8
      ]);

      if (cancelled) return;

      const val = <T,>(i: number): T | null => (results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<T>).value : null);
      const sumRes = (i: number) => (val<{ summary: Summary }>(i)?.summary ?? null);

      const today = sumRes(0);
      const yesterday = sumRes(1);
      const month = sumRes(2);
      const lastMonth = sumRes(3);
      const dues = val<Dues>(4);
      const cash = val<CashBook>(5);
      const bank = val<BankAccounts>(6);
      const deleted = val<DeletedBills>(7);
      const ledger = val<Ledger>(8);

      // Surface an error only if *everything* failed (e.g. not signed in / creds missing).
      const allFailed = results.every((r) => r.status === "rejected");
      if (allFailed) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        setError(first?.reason instanceof AdminApiError ? first.reason.message : "Failed to load finance data");
      }

      setData({
        todayColl: today?.income.fees ?? 0,
        yestColl: yesterday?.income.fees ?? 0,
        monthColl: month?.income.fees ?? 0,
        lastMonthColl: lastMonth?.income.fees ?? 0,
        monthExp: month?.expense.total ?? 0,
        lastMonthExp: lastMonth?.expense.total ?? 0,
        dues,
        cashInHand: cash ? cash.closingBalance : null,
        bankBalance: bank ? bank.accounts.reduce((s, a) => s + (Number(a.currentBalance) || 0), 0) : null,
        cancelledTotal: deleted ? deleted.bills.reduce((s, b) => s + (Number(b.amount) || 0), 0) : 0,
        cancelledCount: deleted?.count ?? 0,
        ledger,
        bills: deleted?.bills ?? [],
        net: month?.net ?? 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [role]);

  if (!hasPermission(role, "fees.view")) {
    return (
      <section className="p-4 md:p-7">
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]"><AlertCircle size={22} /></span>
          <div><h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2><p className="mt-1 text-sm font-medium text-[#7d86a8]">Your role cannot view finance.</p></div>
        </div>
      </section>
    );
  }

  const d = data;
  const collDelta = d ? pct(d.todayColl, d.yestColl) : null;
  const monthCollDelta = d ? pct(d.monthColl, d.lastMonthColl) : null;
  const monthExpDelta = d ? pct(d.monthExp, d.lastMonthExp) : null;

  return (
    <>
      <PageHeader title="Finance Dashboard" description="Fees, accounts, reports, and audit controls." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <Kpi label="Today Collection" value={inr(d?.todayColl ?? 0)} delta={collDelta} deltaSuffix="vs yesterday" tone="bg-[#eef0ff] text-[#3033a1]" icon={Layers} loading={loading} />
          <Kpi label="This Month Collection" value={inr(d?.monthColl ?? 0)} delta={monthCollDelta} deltaSuffix="vs last month" tone="bg-[#e6f8ef] text-[#14a762]" icon={ReceiptIndianRupee} loading={loading} />
          <Kpi label="Pending Dues" value={inr(d?.dues?.grandTotalDue ?? 0)} sub={d?.dues ? `${d.dues.studentsWithDues} students` : undefined} tone="bg-[#fff4df] text-[#e29813]" icon={CalendarClock} loading={loading} />
          <Kpi label="Expenses This Month" value={inr(d?.monthExp ?? 0)} delta={monthExpDelta} deltaSuffix="vs last month" deltaInverse tone="bg-[#ffebed] text-[#ed515d]" icon={ArrowDownRight} loading={loading} />
          <Kpi label="Cash in Hand" value={d?.cashInHand != null ? inr(d.cashInHand) : "—"} sub={d?.cashInHand == null ? "No cash entries" : undefined} tone="bg-[#eaf6ff] text-[#1f7ae0]" icon={Wallet} loading={loading} />
          <Kpi label="Bank Balance" value={d?.bankBalance != null ? inr(d.bankBalance) : "—"} sub={d?.bankBalance == null ? "No bank accounts" : undefined} tone="bg-[#eef0ff] text-[#3033a1]" icon={Landmark} loading={loading} />
          <Kpi label="Cancelled Bills" value={inr(d?.cancelledTotal ?? 0)} sub={`${d?.cancelledCount ?? 0} bills`} tone="bg-[#f3eaff] text-[#7c3aed]" icon={FileMinus} loading={loading} />
        </div>

        {/* Quick links + right rail */}
        <div className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
          <div className="card grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-4">
            <LinkGroup title="Fee Collection" color="text-[#3033a1]" items={[
              { label: "Collect Fee", href: "/admin/payments", icon: Receipt },
              { label: "Dues", href: "/admin/finance/dues", icon: CalendarClock },
              { label: "Installments", href: "/admin/finance/installments", icon: Layers },
              { label: "Receipts", href: "/admin/finance/receivables", icon: ScrollText },
              { label: "Invoices", href: "/admin/finance/invoices", icon: FileText },
            ]} />
            <LinkGroup title="Accounts" color="text-[#1f7ae0]" items={[
              { label: "Expenses", href: "/admin/finance/expenses", icon: ArrowDownRight },
              { label: "Income", href: "/admin/finance/income", icon: ArrowUpRight },
              { label: "Vendors", href: "/admin/finance/vendors", icon: Users },
              { label: "Bank Book", href: "/admin/finance/banking", icon: Landmark },
              { label: "Cash Book", href: "/admin/finance/cash-book", icon: Wallet },
              { label: "Ledger", href: "/admin/finance/ledger", icon: BookOpen },
            ]} />
            <LinkGroup title="Reports" color="text-[#7c3aed]" items={[
              { label: "Trial Balance", href: "/admin/finance/trial-balance", icon: Banknote },
              { label: "P&L Statement", href: "/admin/finance/profit-loss", icon: TrendingUp },
              { label: "Payables", href: "/admin/finance/payables", icon: TrendingDown },
              { label: "Receivables", href: "/admin/finance/receivables", icon: TrendingUp },
              { label: "Statements", href: "/admin/finance/statements", icon: FileText },
            ]} />
            <LinkGroup title="Audit" color="text-[#e29813]" items={[
              { label: "Deleted Bills", href: "/admin/finance/deleted-bills", icon: FileMinus },
              { label: "Branch Accounts", href: "/admin/finance/branch-accounts", icon: Building2 },
            ]} />
          </div>

          {/* Right rail */}
          <div className="space-y-5">
            <RailCard title="Upcoming Dues" href="/admin/finance/dues">
              {(d?.dues?.classes?.length ?? 0) === 0 ? (
                <Empty>{loading ? "Loading…" : "No outstanding dues"}</Empty>
              ) : (
                d!.dues!.classes.slice(0, 5).map((c) => (
                  <Row key={c.className}
                    left={<span className="font-semibold text-[#303247]">Class {c.className}</span>}
                    sub={`${c.studentCount} students`}
                    right={<span className="font-bold text-[#e29813]">{inr(c.totalDue)}</span>}
                  />
                ))
              )}
            </RailCard>

            <RailCard title="Recent Transactions" href="/admin/finance/ledger">
              {(d?.ledger?.entries?.length ?? 0) === 0 ? (
                <Empty>{loading ? "Loading…" : "No transactions yet"}</Empty>
              ) : (
                d!.ledger!.entries.slice(0, 6).map((e, i) => (
                  <Row key={i}
                    left={<span className="font-semibold text-[#303247]">{e.description || e.category}</span>}
                    sub={e.date}
                    right={<span className={`font-bold ${e.type === "income" ? "text-[#14a762]" : "text-[#ed515d]"}`}>{e.type === "income" ? "+" : "−"}{inr(e.amount)}</span>}
                  />
                ))
              )}
            </RailCard>

            <RailCard title="Alerts">
              <AlertsList loading={loading} dues={d?.dues ?? null} net={d?.net ?? 0} />
            </RailCard>
          </div>
        </div>

        {/* Cancelled / deleted bills log */}
        <article className="card overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-[#edf0f7] px-5 py-3">
            <div>
              <h2 className="text-sm font-bold text-[#1f2136]">Deleted / Cancelled Bills Log</h2>
              <p className="text-xs text-[#7d86a8]">Cancelled payments and bills for audit and reconciliation.</p>
            </div>
            <Link href="/admin/finance/deleted-bills" className="text-sm font-semibold text-[#3033a1] hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f8fc] text-xs uppercase tracking-wide text-[#7d86a8]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
                ) : (d?.bills.length ?? 0) === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No cancelled or deleted bills</td></tr>
                ) : (
                  d!.bills.slice(0, 8).map((b) => (
                    <tr key={b.id} className="border-t border-[#edf0f7]">
                      <td className="px-4 py-3 text-stone-500">{b.date}</td>
                      <td className="px-4 py-3"><span className="rounded-full bg-[#eef0ff] px-2.5 py-1 text-xs font-semibold capitalize text-[#3033a1]">{b.type}</span></td>
                      <td className="px-4 py-3">{b.description}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#ed515d]">{inr(b.amount)}</td>
                      <td className="px-4 py-3 text-stone-500">{b.reason || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}

/* ----------------------------- small components ----------------------------- */

function Kpi({ label, value, sub, delta, deltaSuffix, deltaInverse, tone, icon: Icon, loading }: {
  label: string; value: string; sub?: string; delta?: number | null; deltaSuffix?: string; deltaInverse?: boolean;
  tone: string; icon: typeof Wallet; loading?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  // For expenses, a rise is "bad" (red); for collections, a rise is "good" (green).
  const good = deltaInverse ? !up : up;
  return (
    <article className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#7d86a8]">{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon size={18} /></span>
      </div>
      <p className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight text-[#1b1d32]">{loading ? "…" : value}</p>
      {!loading && delta != null && (
        <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${good ? "text-[#14a762]" : "text-[#ed515d]"}`}>
          {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {Math.abs(delta).toFixed(1)}% <span className="font-medium text-[#9aa3bd]">{deltaSuffix}</span>
        </p>
      )}
      {!loading && delta == null && sub && <p className="mt-1 text-xs font-medium text-[#9aa3bd]">{sub}</p>}
    </article>
  );
}

function LinkGroup({ title, color, items }: { title: string; color: string; items: { label: string; href: string; icon: typeof Wallet }[] }) {
  return (
    <div>
      <h3 className={`mb-3 text-sm font-bold ${color}`}>{title}</h3>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.href + it.label}>
            <Link href={it.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-[#5b6478] transition hover:bg-[#f3f5fb] hover:text-[#1f2136]">
              <it.icon size={15} className="text-[#9aa3bd]" /> {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RailCard({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <article className="card p-0">
      <div className="flex items-center justify-between border-b border-[#edf0f7] px-4 py-3">
        <h3 className="text-sm font-bold text-[#1f2136]">{title}</h3>
        {href && <Link href={href} className="text-xs font-semibold text-[#3033a1] hover:underline">View all</Link>}
      </div>
      <div className="divide-y divide-[#f1f3f9]">{children}</div>
    </article>
  );
}

function Row({ left, sub, right }: { left: React.ReactNode; sub?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0">
        <div className="truncate">{left}</div>
        {sub && <p className="text-xs text-[#9aa3bd]">{sub}</p>}
      </div>
      <div className="shrink-0 pl-3">{right}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-sm text-stone-400">{children}</p>;
}

function AlertsList({ loading, dues, net }: { loading: boolean; dues: Dues | null; net: number }) {
  if (loading) return <Empty>Loading…</Empty>;
  const alerts: { tone: string; icon: typeof Wallet; text: string }[] = [];
  if (dues && dues.studentsWithDues > 0) {
    alerts.push({ tone: "text-[#e29813]", icon: AlertTriangle, text: `${dues.studentsWithDues} students have overdue dues · Total ${inr(dues.grandTotalDue)}` });
  }
  if (net < 0) {
    alerts.push({ tone: "text-[#ed515d]", icon: TrendingDown, text: `This month is running a deficit of ${inr(Math.abs(net))}` });
  }
  if (alerts.length === 0) return <Empty>No alerts</Empty>;
  return (
    <>
      {alerts.map((a, i) => (
        <div key={i} className="flex items-start gap-2 px-4 py-3">
          <a.icon size={16} className={`mt-0.5 shrink-0 ${a.tone}`} />
          <p className="text-sm font-medium text-[#5b6478]">{a.text}</p>
        </div>
      ))}
    </>
  );
}
