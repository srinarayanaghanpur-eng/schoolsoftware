"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { AlertCircle, ArrowDownRight, ArrowUpRight, Banknote, ReceiptIndianRupee, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Summary = { income: { fees: number; other: number; total: number }; expense: { general: number; salary: number; advances: number; total: number }; net: number };
type Dues = { classes: { className: string; studentCount: number; totalDue: number }[]; grandTotalDue: number; studentsWithDues: number };
type Ledger = { entries: { date: string; type: "income" | "expense"; category: string; description: string; amount: number; balance: number }[]; closingBalance: number };

function inr(n: number) {
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function Card({ label, value, sub, tone, icon: Icon }: { label: string; value: string; sub?: string; tone: string; icon: typeof Wallet }) {
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#7d86a8]">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span>
      </div>
      <p className="mt-3 text-[30px] font-extrabold leading-none tracking-tight text-[#1b1d32]">{value}</p>
      {sub && <p className="mt-2 text-sm font-semibold text-[#7d86a8]">{sub}</p>}
    </article>
  );
}

export default function FinanceDashboardPage() {
  const { role } = useAdminSession();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dues, setDues] = useState<Dues | null>(null);
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, d, l] = await Promise.all([
          adminApiRequest<{ summary: Summary }>("/api/admin/finance/summary"),
          adminApiRequest<Dues>("/api/admin/finance/dues"),
          adminApiRequest<Ledger>("/api/admin/finance/ledger")
        ]);
        if (cancelled) return;
        setSummary(s.summary);
        setDues(d);
        setLedger(l);
      } catch (e) {
        if (!cancelled) setError(e instanceof AdminApiError ? e.message : "Failed to load finance data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  return (
    <>
      <PageHeader title="Finance Dashboard" description="Income, expenses, dues and ledger at a glance." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Total Income" value={inr(summary?.income.total ?? 0)} sub={`Fees ${inr(summary?.income.fees ?? 0)} · Other ${inr(summary?.income.other ?? 0)}`} tone="bg-[#e6f8ef] text-[#14a762]" icon={ArrowUpRight} />
          <Card label="Total Expense" value={inr(summary?.expense.total ?? 0)} sub={`Salary ${inr(summary?.expense.salary ?? 0)} · General ${inr(summary?.expense.general ?? 0)}`} tone="bg-[#ffebed] text-[#ed515d]" icon={ArrowDownRight} />
          <Card label="Net (P&L)" value={inr(summary?.net ?? 0)} sub={(summary?.net ?? 0) >= 0 ? "Surplus" : "Deficit"} tone="bg-[#eeefff] text-[#3033a1]" icon={TrendingUp} />
          <Card label="Outstanding Dues" value={inr(dues?.grandTotalDue ?? 0)} sub={`${dues?.studentsWithDues ?? 0} students`} tone="bg-[#fff4df] text-[#e29813]" icon={ReceiptIndianRupee} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <article className="card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-bold text-[#1f2136]">Recent ledger</h2>
              <Link href="/admin/finance/ledger" className="text-sm font-bold text-[#3436a2] hover:underline">View all</Link>
            </div>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Date</th><th className="px-4 py-2">Description</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-right">Balance</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
                ) : (ledger?.entries.length ?? 0) === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">No transactions yet</td></tr>
                ) : (
                  ledger!.entries.slice(0, 8).map((e, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-4 py-2 text-stone-500">{e.date}</td>
                      <td className="px-4 py-2">{e.description || e.category}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${e.type === "income" ? "text-[#14a762]" : "text-[#ed515d]"}`}>{e.type === "income" ? "+" : "−"}{inr(e.amount)}</td>
                      <td className="px-4 py-2 text-right text-stone-600">{inr(e.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>

          <article className="card">
            <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold text-[#1f2136]">Dues by class</h2><Link href="/admin/finance/dues" className="text-sm font-bold text-[#3436a2] hover:underline">Details</Link></div>
            <div className="divide-y divide-stone-100">
              {(dues?.classes.length ?? 0) === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-stone-400">No outstanding dues</p>
              ) : (
                dues!.classes.map((c) => (
                  <div key={c.className} className="flex items-center justify-between px-4 py-3">
                    <span className="font-semibold text-[#303247]">Class {c.className}<span className="ml-2 text-xs font-medium text-stone-400">{c.studentCount} students</span></span>
                    <span className="font-bold text-[#e29813]">{inr(c.totalDue)}</span>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/admin/finance/expenses" className="btn-secondary"><Wallet size={16} /> Expenses</Link>
          <Link href="/admin/finance/income" className="btn-secondary"><Banknote size={16} /> Income</Link>
          <Link href="/admin/finance/ledger" className="btn-secondary"><TrendingUp size={16} /> Ledger</Link>
          <Link href="/admin/finance/dues" className="btn-secondary"><ReceiptIndianRupee size={16} /> Dues</Link>
        </div>
      </section>
    </>
  );
}
