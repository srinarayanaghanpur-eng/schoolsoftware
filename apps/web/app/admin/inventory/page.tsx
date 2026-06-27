"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Item = { id: string; name: string; category?: string; stock: number; unitPrice: number };
type Sale = { id: string; itemName?: string; qty: number; amount: number; date: string; buyer?: string };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function InventoryPage() {
  const { role } = useAdminSession();
  const [items, setItems] = useState<Item[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [error, setError] = useState("");
  const [iForm, setIForm] = useState({ name: "", category: "", stock: "", unitPrice: "" });
  const [sForm, setSForm] = useState({ itemId: "", qty: "", buyer: "" });
  const [showI, setShowI] = useState(false);

  async function load() {
    try {
      const [i, s] = await Promise.all([adminApiRequest<{ items: Item[] }>("/api/admin/inventory/items"), adminApiRequest<{ sales: Sale[] }>("/api/admin/inventory/sales")]);
      setItems(i.items); setSales(s.sales);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }
  useEffect(() => { void load(); }, []);

  async function addItem(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/inventory/items", { method: "POST", body: JSON.stringify({ ...iForm, stock: Number(iForm.stock), unitPrice: Number(iForm.unitPrice) }) }); setIForm({ name: "", category: "", stock: "", unitPrice: "" }); setShowI(false); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }
  async function sell(e: FormEvent) { e.preventDefault(); try { await adminApiRequest("/api/admin/inventory/sales", { method: "POST", body: JSON.stringify({ ...sForm, qty: Number(sForm.qty) }) }); setSForm({ itemId: "", qty: "", buyer: "" }); await load(); } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); } }

  if (!hasPermission(role, "inventory.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Inventory / School Store" description="Stock items and sales." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <article className="card overflow-x-auto">
            <div className="flex items-center justify-between px-4 py-3"><h2 className="font-bold text-[#1f2136]">Stock</h2><button className="btn-primary !px-2.5 !py-1.5 text-xs" onClick={() => setShowI((v) => !v)}>{showI ? <X size={14} /> : <Plus size={14} />}</button></div>
            {showI && (
              <form onSubmit={addItem} className="grid gap-2 border-t border-stone-100 p-4 sm:grid-cols-2">
                <input className="field" placeholder="Item name" required value={iForm.name} onChange={(e) => setIForm({ ...iForm, name: e.target.value })} />
                <input className="field" placeholder="Category" value={iForm.category} onChange={(e) => setIForm({ ...iForm, category: e.target.value })} />
                <input className="field" type="number" placeholder="Stock qty" required value={iForm.stock} onChange={(e) => setIForm({ ...iForm, stock: e.target.value })} />
                <input className="field" type="number" placeholder="Unit price ₹" required value={iForm.unitPrice} onChange={(e) => setIForm({ ...iForm, unitPrice: e.target.value })} />
                <button className="btn-primary sm:col-span-2">Add item</button>
              </form>
            )}
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Category</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3 text-right">Price</th></tr></thead>
              <tbody>{items.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">No items</td></tr> : items.map((x) => (<tr key={x.id} className="border-t border-stone-100"><td className="px-4 py-3 font-semibold">{x.name}</td><td className="px-4 py-3">{x.category}</td><td className={`px-4 py-3 text-right font-semibold ${x.stock <= 0 ? "text-[#ed515d]" : ""}`}>{x.stock}</td><td className="px-4 py-3 text-right">{inr(x.unitPrice)}</td></tr>))}</tbody>
            </table>
          </article>

          <div className="space-y-4">
            <form onSubmit={sell} className="card space-y-3 p-5">
              <h2 className="font-bold text-[#1f2136]">Record sale</h2>
              <select className="field" required value={sForm.itemId} onChange={(e) => setSForm({ ...sForm, itemId: e.target.value })}><option value="">Select item</option>{items.map((i) => <option key={i.id} value={i.id} disabled={i.stock <= 0}>{i.name} ({i.stock} in stock)</option>)}</select>
              <input className="field" type="number" min="1" placeholder="Quantity" required value={sForm.qty} onChange={(e) => setSForm({ ...sForm, qty: e.target.value })} />
              <input className="field" placeholder="Buyer (optional)" value={sForm.buyer} onChange={(e) => setSForm({ ...sForm, buyer: e.target.value })} />
              <button className="btn-primary w-full">Sell</button>
            </form>
            <article className="card overflow-x-auto">
              <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Recent sales</h2></div>
              <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2 text-right">Qty</th><th className="px-4 py-2 text-right">Amount</th></tr></thead>
                <tbody>{sales.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-stone-400">No sales</td></tr> : sales.slice(0, 8).map((s) => (<tr key={s.id} className="border-t border-stone-100"><td className="px-4 py-2">{s.itemName}</td><td className="px-4 py-2 text-right">{s.qty}</td><td className="px-4 py-2 text-right font-semibold text-[#14a762]">{inr(s.amount)}</td></tr>))}</tbody>
              </table>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
