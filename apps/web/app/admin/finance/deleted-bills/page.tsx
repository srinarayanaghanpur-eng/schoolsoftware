"use client";

import { PageHeader } from "@/components/PageHeader";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { useEffect, useState } from "react";

type DeletedBill = { id: string; type: string; category: string; amount: number; date: string; description: string; deletedBy?: string; reason?: string };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

const typeTone: Record<string, string> = { expense: "bg-[#ffebed] text-[#ed515d]", payment: "bg-[#fff4df] text-[#e29813]", income: "bg-stone-100 text-stone-600" };

export default function DeletedBillsPage() {
  const { role } = useAdminSession();
  const [bills, setBills] = useState<DeletedBill[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load(range = { from, to }) {
    setLoading(true);
    try {
      const q = new URLSearchParams(); if (range.from) q.set("from", range.from); if (range.to) q.set("to", range.to);
      const r = await adminApiRequest<{ bills: DeletedBill[]; count: number }>(`/api/admin/finance/deleted-bills?${q}`);
      setBills(r.bills); setCount(r.count);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const totalLost = bills.reduce((s, b) => s + b.amount, 0);

  return (
    <>
      <PageHeader title="Deleted / Cancelled Bills Log" description="Track deleted expenses, cancelled payments and rejected items." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <DateRangeFilter
          from={from}
          to={to}
          onChange={({ from, to }) => { setFrom(from); setTo(to); }}
          onApply={load}
          loading={loading}
          rightSlot={<span className="text-sm font-bold text-[#1f2136]">{count} deleted · {inr(totalLost)} total</span>}
        />

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Reason</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
              : bills.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No deleted or cancelled bills</td></tr>
              : bills.map((b, i) => (
                <tr key={i} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-500">{b.date}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${typeTone[b.type] || typeTone.expense}`}>{formatLabel(b.type)}</span></td>
                  <td className="px-4 py-3">{b.description || b.category}</td>
                  <td className="px-4 py-3 text-right font-semibold text-[#ed515d]">{inr(b.amount)}</td>
                  <td className="px-4 py-3 text-stone-500">{b.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
