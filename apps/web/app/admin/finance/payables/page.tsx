"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type VendorPayable = { vendorId: string; vendorName: string; total: number; paid: number; due: number; count: number };
type PayableSummary = { totalPayable: number; totalPaid: number; outstanding: number; billCount: number; unpaidCount: number; partialCount: number; paidCount: number };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function PayablesPage() {
  const { role } = useAdminSession();
  const [summary, setSummary] = useState<PayableSummary | null>(null);
  const [byVendor, setByVendor] = useState<VendorPayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try { const r = await adminApiRequest<{ summary: PayableSummary; byVendor: VendorPayable[] }>("/api/admin/finance/payables"); setSummary(r.summary); setByVendor(r.byVendor); }
      catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Payables" description="Outstanding bills and vendor-wise payable amounts." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {loading ? <div className="card p-8 text-center text-stone-400">Loading…</div> : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Total Payable</p><p className="text-2xl font-extrabold text-[#ed515d]">{inr(summary?.outstanding ?? 0)}</p></div>
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Already Paid</p><p className="text-2xl font-extrabold text-[#14a762]">{inr(summary?.totalPaid ?? 0)}</p></div>
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Total Bills</p><p className="text-2xl font-extrabold text-[#1f2136]">{summary?.billCount ?? 0}</p></div>
              <div className="card p-4"><p className="text-sm font-semibold text-[#7d86a8]">Unpaid / Partial</p><p className="text-2xl font-extrabold text-[#e29813]">{(summary?.unpaidCount ?? 0) + (summary?.partialCount ?? 0)}</p></div>
            </div>

            <article className="card overflow-x-auto">
              <h2 className="border-b border-stone-100 px-4 py-3 font-bold text-[#1f2136]">By Vendor</h2>
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Vendor</th><th className="px-4 py-2 text-right">Bills</th><th className="px-4 py-2 text-right">Total</th><th className="px-4 py-2 text-right">Paid</th><th className="px-4 py-2 text-right">Due</th></tr></thead>
                <tbody>
                  {byVendor.length === 0 ? <tr><td colSpan={5} className="px-4 py-6 text-center text-stone-400">No vendor bills</td></tr>
                  : byVendor.map((v) => (
                    <tr key={v.vendorId} className="border-t border-stone-100">
                      <td className="px-4 py-2 font-medium">{v.vendorName}</td>
                      <td className="px-4 py-2 text-right text-stone-500">{v.count}</td>
                      <td className="px-4 py-2 text-right">{inr(v.total)}</td>
                      <td className="px-4 py-2 text-right text-[#14a762]">{inr(v.paid)}</td>
                      <td className="px-4 py-2 text-right font-semibold text-[#ed515d]">{inr(v.due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          </>
        )}
      </section>
    </>
  );
}
