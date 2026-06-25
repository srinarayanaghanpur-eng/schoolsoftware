"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Income = { id: string; category: string; amount: number; date: string; description: string; source?: string; paymentMethod: string };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
const CATEGORIES = ["donation", "rent", "grant", "event", "misc"];
const METHODS = ["cash", "bank", "upi", "cheque", "card"];
const blank = { category: "donation", amount: "", date: new Date().toISOString().slice(0, 10), description: "", source: "", paymentMethod: "cash" };

export default function IncomePage() {
  const { role } = useAdminSession();
  const [items, setItems] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  async function load() {
    try { setItems((await adminApiRequest<{ incomes: Income[] }>("/api/admin/finance/incomes")).incomes); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { await adminApiRequest("/api/admin/finance/incomes", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) }); setForm(blank); setShowForm(false); await load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Other Income" description="Donations, rent, grants and miscellaneous income." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex justify-end"><button className="btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Close" : "Add income"}</button></div>
        {showForm && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#303247]">Category<select className="field mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="text-sm font-semibold text-[#303247]">Amount (₹)<input className="field mt-1" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="text-sm font-semibold text-[#303247]">Date<input className="field mt-1" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="text-sm font-semibold text-[#303247]">Payment method<select className="field mt-1" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
            <label className="text-sm font-semibold text-[#303247] sm:col-span-2">Description<input className="field mt-1" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="sm:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save income"}</button></div>
          </form>
        )}
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
              : items.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400">No income recorded yet</td></tr>
              : items.map((x) => (<tr key={x.id} className="border-t border-stone-100"><td className="px-4 py-3 text-stone-500">{x.date}</td><td className="px-4 py-3 capitalize">{x.category}</td><td className="px-4 py-3">{x.description}</td><td className="px-4 py-3 text-right font-semibold text-[#14a762]">{inr(x.amount)}</td></tr>))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
