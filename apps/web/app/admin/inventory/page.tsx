"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { AlertTriangle, ArrowDownUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Item = { id: string; name: string; category?: string; stock: number; unitPrice: number; minStock?: number };
type Sale = { id: string; itemName?: string; qty: number; amount: number; date: string; buyer?: string };
type Movement = { id: string; itemName?: string; delta: number; reason?: string; balanceAfter: number; createdAt?: string };

const emptyItem = { name: "", category: "", stock: "", unitPrice: "", minStock: "5" };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function InventoryPage() {
  const { role } = useAdminSession();
  const toast = usePopup();
  const canEdit = hasPermission(role, "inventory.edit");
  const canDelete = hasPermission(role, "inventory.delete");
  const [items, setItems] = useState<Item[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [iForm, setIForm] = useState({ ...emptyItem });
  const [editingItemId, setEditingItemId] = useState("");
  const [sForm, setSForm] = useState({ itemId: "", qty: "", buyer: "" });
  const [aForm, setAForm] = useState({ itemId: "", delta: "", reason: "" });
  const [showI, setShowI] = useState(false);
  const [showA, setShowA] = useState(false);

  async function load() {
    try {
      const [i, s, m] = await Promise.all([
        adminApiRequest<{ items: Item[] }>("/api/admin/inventory/items"),
        adminApiRequest<{ sales: Sale[] }>("/api/admin/inventory/sales"),
        adminApiRequest<{ movements: Movement[] }>("/api/admin/inventory/movements").catch(() => ({ movements: [] }))
      ]);
      setItems(i.items); setSales(s.sales); setMovements(m.movements || []);
    } catch (e) { toast.error("Failed to load inventory", e instanceof AdminApiError ? e.message : undefined); }
  }
  useEffect(() => { void load(); }, []);

  function resetItem() { setIForm({ ...emptyItem }); setEditingItemId(""); }
  function startAdd() { resetItem(); setShowI(true); }
  function startEdit(x: Item) { setEditingItemId(x.id); setIForm({ name: x.name, category: x.category || "", stock: String(x.stock), unitPrice: String(x.unitPrice), minStock: String(x.minStock ?? 5) }); setShowI(true); }

  async function saveItem(e: FormEvent) {
    e.preventDefault();
    try {
      const payload = { ...iForm, stock: Number(iForm.stock), unitPrice: Number(iForm.unitPrice), minStock: Number(iForm.minStock) };
      if (editingItemId) await adminApiRequest(`/api/admin/inventory/items/${editingItemId}`, { method: "PUT", body: JSON.stringify({ ...payload, stock: undefined }) });
      else await adminApiRequest("/api/admin/inventory/items", { method: "POST", body: JSON.stringify(payload) });
      resetItem(); setShowI(false); toast.success(editingItemId ? "Item updated" : "Item added"); await load();
    } catch (e) { toast.error(editingItemId ? "Failed to update item" : "Failed to add item", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function sell(e: FormEvent) {
    e.preventDefault();
    try { await adminApiRequest("/api/admin/inventory/sales", { method: "POST", body: JSON.stringify({ ...sForm, qty: Number(sForm.qty) }) }); setSForm({ itemId: "", qty: "", buyer: "" }); toast.success("Sale recorded"); await load(); }
    catch (e) { toast.error("Failed to record sale", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function adjust(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await adminApiRequest<{ stock: number }>(`/api/admin/inventory/items/${aForm.itemId}/stock`, { method: "POST", body: JSON.stringify({ delta: Number(aForm.delta), reason: aForm.reason }) });
      toast.success(`Stock updated to ${res.stock}`); setAForm({ itemId: "", delta: "", reason: "" }); setShowA(false); await load();
    } catch (e) { toast.error("Failed to adjust stock", e instanceof AdminApiError ? e.message : undefined); }
  }

  async function delItem(x: Item) {
    const ok = await toast.confirm(`Delete "${x.name}"?`, "This cannot be undone.", { okLabel: "Delete", danger: true });
    if (!ok) return;
    try { await adminApiRequest(`/api/admin/inventory/items/${x.id}`, { method: "DELETE" }); toast.success("Item deleted"); await load(); }
    catch (e) { toast.error("Failed to delete item", e instanceof AdminApiError ? e.message : undefined); }
  }

  if (!hasPermission(role, "inventory.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  const lowStock = items.filter((x) => (x.minStock ?? 5) > 0 && x.stock <= (x.minStock ?? 5));

  return (
    <>
      <PageHeader title="Inventory / School Store" description="Stock, purchases/adjustments, low-stock alerts and sales." />
      <section className="space-y-5 p-4 md:p-7">
        {lowStock.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span><strong>{lowStock.length} item(s) low on stock:</strong> {lowStock.map((x) => `${x.name} (${x.stock})`).join(", ")}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canEdit && <button className="btn-primary" onClick={startAdd}>{showI && !editingItemId ? <X size={16} /> : <Plus size={16} />} Add item</button>}
          {canEdit && <button className="btn-secondary" onClick={() => setShowA((v) => !v)}>{showA ? <X size={16} /> : <ArrowDownUp size={16} />} Stock in / out</button>}
        </div>

        {showI && (
          <form onSubmit={saveItem} className="card grid gap-2 p-5 sm:grid-cols-5">
            <input className="field" placeholder="Item name" required value={iForm.name} onChange={(e) => setIForm({ ...iForm, name: e.target.value })} />
            <input className="field" placeholder="Category" value={iForm.category} onChange={(e) => setIForm({ ...iForm, category: e.target.value })} />
            <input className="field" type="number" placeholder="Stock qty" required disabled={Boolean(editingItemId)} value={iForm.stock} onChange={(e) => setIForm({ ...iForm, stock: e.target.value })} />
            <input className="field" type="number" placeholder="Unit price ₹" required value={iForm.unitPrice} onChange={(e) => setIForm({ ...iForm, unitPrice: e.target.value })} />
            <input className="field" type="number" min="0" placeholder="Low-stock at" value={iForm.minStock} onChange={(e) => setIForm({ ...iForm, minStock: e.target.value })} />
            <div className="flex gap-2 sm:col-span-5"><button className="btn-primary flex-1">{editingItemId ? "Save changes" : "Add item"}</button><button type="button" className="btn-secondary" onClick={() => { resetItem(); setShowI(false); }}>Cancel</button></div>
            {editingItemId && <p className="text-xs text-stone-500 sm:col-span-5">Use “Stock in / out” to change quantity so the movement log stays accurate.</p>}
          </form>
        )}

        {showA && canEdit && (
          <form onSubmit={adjust} className="card grid gap-2 p-5 sm:grid-cols-4">
            <select className="field" required value={aForm.itemId} onChange={(e) => setAForm({ ...aForm, itemId: e.target.value })}><option value="">Select item</option>{items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.stock} in stock)</option>)}</select>
            <input className="field" type="number" placeholder="+ in / - out (e.g. 25 or -3)" required value={aForm.delta} onChange={(e) => setAForm({ ...aForm, delta: e.target.value })} />
            <input className="field" placeholder="Reason (purchase, damage…)" value={aForm.reason} onChange={(e) => setAForm({ ...aForm, reason: e.target.value })} />
            <button className="btn-primary">Apply adjustment</button>
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <article className="card overflow-x-auto">
            <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Stock</h2></div>
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-3 py-3 sm:px-4">Item</th><th className="px-3 py-3 sm:px-4">Category</th><th className="px-3 py-3 text-right sm:px-4">Stock</th><th className="px-3 py-3 text-right sm:px-4">Price</th>{(canEdit || canDelete) && <th className="px-3 py-3 text-right sm:px-4">Action</th>}</tr></thead>
              <tbody>{items.length === 0 ? <tr><td colSpan={canEdit || canDelete ? 5 : 4} className="px-4 py-8 text-center text-stone-400">No items</td></tr> : items.map((x) => { const low = (x.minStock ?? 5) > 0 && x.stock <= (x.minStock ?? 5); return (<tr key={x.id} className="border-t border-stone-100"><td className="px-4 py-3 font-semibold">{x.name}</td><td className="px-4 py-3">{x.category}</td><td className={`px-4 py-3 text-right font-semibold ${x.stock <= 0 ? "text-[#ed515d]" : low ? "text-amber-600" : ""}`}>{x.stock}{low && <span className="block text-[10px] uppercase">low</span>}</td><td className="px-4 py-3 text-right">{inr(x.unitPrice)}</td>{(canEdit || canDelete) && <td className="px-4 py-3 text-right"><div className="inline-flex gap-1">{canEdit && <button onClick={() => startEdit(x)} aria-label={`Edit ${x.name}`} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700"><Pencil size={13} /> Edit</button>}{canDelete && <button onClick={() => delItem(x)} aria-label={`Delete ${x.name}`} className="inline-flex items-center gap-1 rounded-lg bg-[#ffebed] px-2 py-1 text-xs font-bold text-[#ed515d]"><Trash2 size={13} /> Delete</button>}</div></td>}</tr>); })}</tbody>
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
              <div className="px-4 py-3"><h2 className="font-bold text-[#1f2136]">Recent stock movements</h2></div>
              <table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Reason</th><th className="px-4 py-2 text-right">Change</th><th className="px-4 py-2 text-right">Balance</th></tr></thead>
                <tbody>{movements.length === 0 ? <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">No adjustments</td></tr> : movements.slice(0, 10).map((m) => (<tr key={m.id} className="border-t border-stone-100"><td className="px-4 py-2">{m.itemName}</td><td className="px-4 py-2 text-stone-500">{m.reason || "—"}</td><td className={`px-4 py-2 text-right font-semibold ${m.delta > 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td><td className="px-4 py-2 text-right">{m.balanceAfter}</td></tr>))}</tbody>
              </table>
            </article>
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
