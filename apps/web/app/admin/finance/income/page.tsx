"use client";

import { PageHeader } from "@/components/PageHeader";
import { ResponsiveTable, type Column } from "@/components/ResponsiveTable";
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

const incomeColumns: Column<Income>[] = [
  { key: "description", header: "Description", primary: true, cell: (x) => x.description || "—" },
  { key: "date", header: "Date", cell: (x) => <span className="text-stone-500">{x.date}</span> },
  { key: "category", header: "Category", cell: (x) => <span className="capitalize">{x.category}</span> },
  { key: "amount", header: "Amount", align: "right", cell: (x) => <span className="font-semibold text-[#14a762]">{inr(x.amount)}</span> },
];

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
        {loading ? (
          <div className="card p-8 text-center text-sm font-medium text-stone-400">Loading…</div>
        ) : (
          <ResponsiveTable
            rows={items}
            rowKey={(x) => x.id}
            minTableWidth={600}
            empty="No income recorded yet"
            columns={incomeColumns}
          />
        )}
      </section>
    </>
  );
}
