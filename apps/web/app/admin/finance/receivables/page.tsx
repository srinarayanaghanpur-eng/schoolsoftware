"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { useEffect, useState } from "react";

type ClassReceivable = { className: string; count: number; totalFees: number; paid: number; due: number };
type ReceivableSummary = { totalReceivable: number; totalFees: number; totalPaid: number; studentCount: number };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function ReceivablesPage() {
  const { role } = useAdminSession();
  const [summary, setSummary] = useState<ReceivableSummary | null>(null);
  const [byClass, setByClass] = useState<ClassReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try { const r = await adminApiRequest<{ summary: ReceivableSummary; byClass: ClassReceivable[] }>("/api/admin/finance/receivables"); setSummary(r.summary); setByClass(r.byClass); }
      catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const collectionRate = summary && summary.totalFees > 0 ? ((summary.totalPaid / summary.totalFees) * 100).toFixed(1) : "0";

  return (
    <>
      <PageHeader title="Receivables" description="Outstanding fee receivables grouped by class." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {loading ? <div className="card p-8 text-center text-stone-400">Loading…</div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Total Receivable</p><p className="text-2xl font-extrabold text-[#ed515d]">{inr(summary?.totalReceivable ?? 0)}</p></div>
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Already Collected</p><p className="text-2xl font-extrabold text-[#14a762]">{inr(summary?.totalPaid ?? 0)}</p></div>
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Students with Dues</p><p className="text-2xl font-extrabold text-[#1f2136]">{summary?.studentCount ?? 0}</p></div>
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Collection Rate</p><p className="text-2xl font-extrabold text-[#3033a1]">{collectionRate}%</p></div>
            </div>

            <div>
              <h2 className="mb-3 px-1 font-bold text-[#1f2136]">By Class</h2>

              {/* Mobile: class receivable cards */}
              <div className="space-y-3 md:hidden">
                {byClass.length === 0 ? (
                  <div className="card p-6 text-center text-sm text-stone-400">No receivables</div>
                ) : byClass.map((c) => {
                  const rate = c.totalFees > 0 ? ((c.paid / c.totalFees) * 100).toFixed(1) : "0";
                  return (
                    <div key={c.className} className="card p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-[#1f2136]">Class {c.className}</span>
                        <span className="text-xs font-semibold text-stone-500">{c.count} students · {rate}%</span>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-[#f7f8fd] p-2">
                          <dt className="text-[10px] font-semibold uppercase text-stone-500">Total</dt>
                          <dd className="text-sm font-bold text-[#303247]">{inr(c.totalFees)}</dd>
                        </div>
                        <div className="rounded-lg bg-[#f6faf6] p-2">
                          <dt className="text-[10px] font-semibold uppercase text-stone-500">Collected</dt>
                          <dd className="text-sm font-bold text-[#14a762]">{inr(c.paid)}</dd>
                        </div>
                        <div className="rounded-lg bg-[#fff7f7] p-2">
                          <dt className="text-[10px] font-semibold uppercase text-stone-500">Due</dt>
                          <dd className="text-sm font-bold text-[#ed515d]">{inr(c.due)}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / tablet: table */}
              <article className="card hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Class</th><th className="px-4 py-2 text-right">Students</th><th className="px-4 py-2 text-right">Total Fees</th><th className="px-4 py-2 text-right">Collected</th><th className="px-4 py-2 text-right">Receivable</th><th className="px-4 py-2 text-right">Rate</th></tr></thead>
                  <tbody>
                    {byClass.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-stone-400">No receivables</td></tr>
                    : byClass.map((c) => {
                      const rate = c.totalFees > 0 ? ((c.paid / c.totalFees) * 100).toFixed(1) : "0";
                      return (
                        <tr key={c.className} className="border-t border-stone-100">
                          <td className="px-4 py-2 font-medium">Class {c.className}</td>
                          <td className="px-4 py-2 text-right text-stone-500">{c.count}</td>
                          <td className="px-4 py-2 text-right">{inr(c.totalFees)}</td>
                          <td className="px-4 py-2 text-right text-[#14a762]">{inr(c.paid)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-[#ed515d]">{inr(c.due)}</td>
                          <td className="px-4 py-2 text-right text-stone-600">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            </div>
          </>
        )}
      </section>
    </>
  );
}
