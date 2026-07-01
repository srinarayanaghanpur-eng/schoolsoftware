"use client";

import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { useEffect, useState } from "react";

type TBEntry = { account: string; type: "debit" | "credit"; amount: number; nature: string };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function TrialBalancePage() {
  const { role } = useAdminSession();
  const [debits, setDebits] = useState<TBEntry[]>([]);
  const [credits, setCredits] = useState<TBEntry[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);
  const [diff, setDiff] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load(range = { from, to }) {
    setLoading(true);
    try {
      const q = new URLSearchParams(); if (range.from) q.set("from", range.from); if (range.to) q.set("to", range.to);
      const r = await adminApiRequest<{ debitEntries: TBEntry[]; creditEntries: TBEntry[]; totalDebit: number; totalCredit: number; difference: number }>(`/api/admin/finance/trial-balance?${q}`);
      setDebits(r.debitEntries); setCredits(r.creditEntries);
      setTotalDebit(r.totalDebit); setTotalCredit(r.totalCredit); setDiff(r.difference);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const balanced = Math.abs(diff) < 0.01;

  return (
    <>
      <PageHeader title="Trial Balance" description="Debit and credit balances for the period." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <DateRangeFilter
          from={from}
          to={to}
          onChange={({ from, to }) => { setFrom(from); setTo(to); }}
          onApply={load}
          loading={loading}
          rightSlot={
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${balanced ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#ffebed] text-[#ed515d]"}`}>
              {balanced ? "Balanced" : `Difference: ${inr(diff)}`}
            </span>
          }
        />

        {loading ? (
          <div className="card p-8 text-center text-stone-400">Loading…</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            <article className="card overflow-x-auto">
              <h2 className="border-b border-stone-100 px-4 py-3 font-bold text-[#ed515d]">Debit</h2>
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Account</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {debits.length === 0 ? <tr><td colSpan={2} className="px-4 py-6 text-center text-stone-400">No debit entries</td></tr>
                  : debits.map((e, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-4 py-2">{e.account} <span className="text-xs text-stone-400">({e.nature})</span></td>
                      <td className="px-4 py-2 text-right font-semibold text-[#ed515d]">{inr(e.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-stone-300 font-bold"><td className="px-4 py-2 text-[#1f2136]">Total</td><td className="px-4 py-2 text-right text-[#ed515d]">{inr(totalDebit)}</td></tr>
                </tbody>
              </table>
            </article>

            <article className="card overflow-x-auto">
              <h2 className="border-b border-stone-100 px-4 py-3 font-bold text-[#14a762]">Credit</h2>
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Account</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {credits.length === 0 ? <tr><td colSpan={2} className="px-4 py-6 text-center text-stone-400">No credit entries</td></tr>
                  : credits.map((e, i) => (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-4 py-2">{e.account} <span className="text-xs text-stone-400">({e.nature})</span></td>
                      <td className="px-4 py-2 text-right font-semibold text-[#14a762]">{inr(e.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-stone-300 font-bold"><td className="px-4 py-2 text-[#1f2136]">Total</td><td className="px-4 py-2 text-right text-[#14a762]">{inr(totalCredit)}</td></tr>
                </tbody>
              </table>
            </article>
          </div>
        )}
      </section>
    </>
  );
}
