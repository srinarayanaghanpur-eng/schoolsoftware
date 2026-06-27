"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Vendor = { id: string; name: string; phone?: string; contact?: string };
type Purchase = { id: string; vendorName?: string; date: string; amount: number; amountPaid: number; status: "unpaid" | "partial" | "paid"; category?: string };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
const statusTone: Record<string, string> = { unpaid: "bg-[#ffebed] text-[#ed515d]", partial: "bg-[#fff4df] text-[#b8791a]", paid: "bg-[#e6f8ef] text-[#14a762]" };

export default function VendorsPage() {
  const { role } = useAdminSession();
  const canPay = hasPermission(role, "fees.approve");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [error, setError] = useState("");
  const [vForm, setVForm] = useState({ name: "", phone: "" });
  const [pForm, setPForm] = useState({ vendorId: "", date: new Date().toISOString().slice(0, 10), amount: "", category: "supplies" });
  const [showV, setShowV] = useState(false);
  const [showP, setShowP] = useState(false);

  async function load() {
    try {
      const [v, p] = await Promise.all([
        adminApiRequest<{ vendors: Vendor[] }>("/api/admin/finance/vendors"),
        adminApiRequest<{ purchases: Purchase[] }>("/api/admin/finance/purchases")
      ]);
      setVendors(v.vendors); setPurchases(p.purchases);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }
  useEffect(() => { void load(); }, []);

  async function addVendor(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/finance/vendors", { method: "POST", body: JSON.stringify(vForm) }); setVForm({ name: "", phone: "" }); setShowV(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function addPurchase(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/finance/purchases", { method: "POST", body: JSON.stringify({ ...pForm, amount: Number(pForm.amount) }) }); setPForm({ ...pForm, amount: "" }); setShowP(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function pay(id: string, amount: number) { try { await adminApiRequest(`/api/admin/finance/purchases/${id}/pay`, { method: "POST", body: JSON.stringify({ amount, method: "bank" }) }); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Vendors & Purchases" description="Manage vendors and pay purchase bills (payables)." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
          <article className="card">
            <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold text-[#1f2136]">Vendors</h2><button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setShowV((v) => !v)}>{showV ? <X size={14} /> : <Plus size={14} />}</button></div>
            {showV && (
              <form onSubmit={addVendor} className="space-y-2 border-t border-stone-100 p-4">
                <input className="field" placeholder="Vendor name" required value={vForm.name} onChange={(e) => setVForm({ ...vForm, name: e.target.value })} />
                <input className="field" placeholder="Phone" value={vForm.phone} onChange={(e) => setVForm({ ...vForm, phone: e.target.value })} />
                <button className="btn-primary w-full">Add vendor</button>
              </form>
            )}
            <div className="divide-y divide-stone-100">
              {vendors.length === 0 ? <p className="px-4 py-6 text-center text-sm text-stone-400">No vendors</p> : vendors.map((v) => (<div key={v.id} className="px-4 py-3"><p className="font-semibold text-[#303247]">{v.name}</p>{v.phone && <p className="text-xs text-stone-400">{v.phone}</p>}</div>))}
            </div>
          </article>

          <article className="card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold text-[#1f2136]">Purchase bills</h2><button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setShowP((v) => !v)} disabled={vendors.length === 0}>{showP ? <X size={14} /> : <Plus size={14} />}</button></div>
            {showP && (
              <form onSubmit={addPurchase} className="grid gap-2 border-t border-stone-100 p-4 sm:grid-cols-2">
                <select className="field" required value={pForm.vendorId} onChange={(e) => setPForm({ ...pForm, vendorId: e.target.value })}><option value="">Select vendor</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
                <input className="field" type="number" min="1" placeholder="Amount ₹" required value={pForm.amount} onChange={(e) => setPForm({ ...pForm, amount: e.target.value })} />
                <input className="field" type="date" value={pForm.date} onChange={(e) => setPForm({ ...pForm, date: e.target.value })} />
                <input className="field" placeholder="Category" value={pForm.category} onChange={(e) => setPForm({ ...pForm, category: e.target.value })} />
                <button className="btn-primary sm:col-span-2">Add bill</button>
              </form>
            )}
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3 text-right">Paid</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
              <tbody>
                {purchases.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">No bills</td></tr> : purchases.map((p) => (
                  <tr key={p.id} className="border-t border-stone-100">
                    <td className="px-4 py-3">{p.vendorName}</td><td className="px-4 py-3 text-stone-500">{p.date}</td>
                    <td className="px-4 py-3 text-right font-semibold">{inr(p.amount)}</td><td className="px-4 py-3 text-right text-stone-600">{inr(p.amountPaid)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold capitalize ${statusTone[p.status]}`}>{p.status}</span></td>
                    <td className="px-4 py-3">{p.status !== "paid" && canPay && <button onClick={() => pay(p.id, p.amount - p.amountPaid)} className="rounded-lg bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]">Pay {inr(p.amount - p.amountPaid)}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      </section>
    </>
  );
}
