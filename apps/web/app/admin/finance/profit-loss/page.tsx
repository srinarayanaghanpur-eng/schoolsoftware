"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";

type BreakdownItem = { label: string; amount: number };
type PLData = { income: { breakdown: BreakdownItem[]; total: number }; expense: { breakdown: BreakdownItem[]; total: number }; netProfit: number };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function ProfitLossPage() {
  const { role } = useAdminSession();
  const [data, setData] = useState<PLData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams(); if (from) q.set("from", from); if (to) q.set("to", to);
      const r = await adminApiRequest<PLData>(`/api/admin/finance/profit-loss?${q}`);
      setData(r);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Profit & Loss Statement" description="Income and expense breakdown for the period." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="card flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-semibold text-[#303247]">From<input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm font-semibold text-[#303247]">To<input type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn-primary" onClick={load}>Apply</button>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-stone-400">Loading…</div>
        ) : !data ? null : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">Total Income</p>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f8ef] text-[#14a762]"><ArrowUpRight size={20} /></span>
                </div>
                <p className="mt-3 text-[30px] font-extrabold leading-none tracking-tight text-[#1b1d32]">{inr(data.income.total)}</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">Total Expense</p>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ffebed] text-[#ed515d]"><ArrowDownRight size={20} /></span>
                </div>
                <p className="mt-3 text-[30px] font-extrabold leading-none tracking-tight text-[#1b1d32]">{inr(data.expense.total)}</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">Net {data.netProfit >= 0 ? "Profit" : "Loss"}</p>
                  <span className={`grid h-10 w-10 place-items-center rounded-xl ${data.netProfit >= 0 ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#ffebed] text-[#ed515d]"}`}>
                    {data.netProfit >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                  </span>
                </div>
                <p className={`mt-3 text-[30px] font-extrabold leading-none tracking-tight ${data.netProfit >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(data.netProfit)}</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <article className="card overflow-x-auto">
                <h2 className="border-b border-stone-100 px-4 py-3 font-bold text-[#14a762]">Income</h2>
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {data.income.breakdown.map((b, i) => (
                      <tr key={i} className="border-t border-stone-100">
                        <td className="px-4 py-2">{b.label}</td>
                        <td className="px-4 py-2 text-right font-semibold text-[#14a762]">{inr(b.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-stone-300 font-bold"><td className="px-4 py-2 text-[#1f2136]">Total Income</td><td className="px-4 py-2 text-right text-[#14a762]">{inr(data.income.total)}</td></tr>
                  </tbody>
                </table>
              </article>

              <article className="card overflow-x-auto">
                <h2 className="border-b border-stone-100 px-4 py-3 font-bold text-[#ed515d]">Expenses</h2>
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Category</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
                  <tbody>
                    {data.expense.breakdown.map((b, i) => (
                      <tr key={i} className="border-t border-stone-100">
                        <td className="px-4 py-2">{b.label}</td>
                        <td className="px-4 py-2 text-right font-semibold text-[#ed515d]">{inr(b.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-stone-300 font-bold"><td className="px-4 py-2 text-[#1f2136]">Total Expenses</td><td className="px-4 py-2 text-right text-[#ed515d]">{inr(data.expense.total)}</td></tr>
                  </tbody>
                </table>
              </article>
            </div>

            <div className="card p-5 text-center">
              <p className="text-sm font-semibold text-[#7d86a8]">Net {data.netProfit >= 0 ? "Profit" : "Loss"}</p>
              <p className={`text-4xl font-extrabold ${data.netProfit >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(Math.abs(data.netProfit))}</p>
            </div>
          </>
        )}
      </section>
    </>
  );
}
