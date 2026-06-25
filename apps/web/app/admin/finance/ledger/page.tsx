"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { useEffect, useState } from "react";

type Entry = { date: string; type: "income" | "expense"; category: string; description: string; amount: number; balance: number; source: string };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function LedgerPage() {
  const { role } = useAdminSession();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [closing, setClosing] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      const q = new URLSearchParams(); if (from) q.set("from", from); if (to) q.set("to", to);
      const r = await adminApiRequest<{ entries: Entry[]; closingBalance: number }>(`/api/admin/finance/ledger?${q}`);
      setEntries(r.entries); setClosing(r.closingBalance);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Ledger" description="Every money movement with running balance." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="card flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-semibold text-[#303247]">From<input type="date" className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-sm font-semibold text-[#303247]">To<input type="date" className="field mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn-primary" onClick={load}>Apply</button>
          <span className="ml-auto text-sm font-bold text-[#1f2136]">Closing balance: <span className={closing >= 0 ? "text-[#14a762]" : "text-[#ed515d]"}>{inr(closing)}</span></span>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Balance</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
              : entries.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No transactions</td></tr>
              : entries.map((e, i) => (
                <tr key={i} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-500">{e.date}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${e.type === "income" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#ffebed] text-[#ed515d]"}`}>{e.type}</span></td>
                  <td className="px-4 py-3">{e.description || e.category}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${e.type === "income" ? "text-[#14a762]" : "text-[#ed515d]"}`}>{e.type === "income" ? "+" : "−"}{inr(e.amount)}</td>
                  <td className="px-4 py-3 text-right text-stone-600">{inr(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
