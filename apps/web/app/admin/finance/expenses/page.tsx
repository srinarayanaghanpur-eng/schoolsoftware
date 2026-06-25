"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Check, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Expense = { id: string; category: string; amount: number; date: string; description: string; vendor?: string; paymentMethod: string; status: "pending" | "approved" | "rejected" };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }
const CATEGORIES = ["utilities", "maintenance", "supplies", "vendor", "rent", "other"];
const METHODS = ["cash", "bank", "upi", "cheque", "card"];
const blank = { category: "utilities", amount: "", date: new Date().toISOString().slice(0, 10), description: "", vendor: "", paymentMethod: "cash" };

const statusTone: Record<string, string> = { pending: "bg-[#fff4df] text-[#b8791a]", approved: "bg-[#e6f8ef] text-[#14a762]", rejected: "bg-[#ffebed] text-[#ed515d]" };

export default function ExpensesPage() {
  const { role } = useAdminSession();
  const canApprove = hasPermission(role, "fees.approve");
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  async function load() {
    try { setItems((await adminApiRequest<{ expenses: Expense[] }>("/api/admin/finance/expenses")).expenses); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await adminApiRequest("/api/admin/finance/expenses", { method: "POST", body: JSON.stringify({ ...form, amount: Number(form.amount) }) });
      setForm(blank); setShowForm(false); await load();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  async function setStatus(id: string, status: "approved" | "rejected") {
    try { await adminApiRequest(`/api/admin/finance/expenses/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Expenses" description="Record and approve school expenses." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>{showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Close" : "Add expense"}</button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#303247]">Category
              <select className="field mt-1" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </label>
            <label className="text-sm font-semibold text-[#303247]">Amount (₹)
              <input className="field mt-1" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label className="text-sm font-semibold text-[#303247]">Date
              <input className="field mt-1" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="text-sm font-semibold text-[#303247]">Payment method
              <select className="field mt-1" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
            </label>
            <label className="text-sm font-semibold text-[#303247] sm:col-span-2">Description
              <input className="field mt-1" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Electricity bill — June" />
            </label>
            <div className="sm:col-span-2"><button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save expense"}</button></div>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Description</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
              : items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400">No expenses recorded yet</td></tr>
              : items.map((x) => (
                <tr key={x.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 text-stone-500">{x.date}</td>
                  <td className="px-4 py-3 capitalize">{x.category}</td>
                  <td className="px-4 py-3">{x.description}</td>
                  <td className="px-4 py-3 text-right font-semibold">{inr(x.amount)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusTone[x.status]}`}>{x.status}</span></td>
                  <td className="px-4 py-3">
                    {x.status === "pending" && canApprove ? (
                      <div className="flex gap-2">
                        <button onClick={() => setStatus(x.id, "approved")} className="grid h-8 w-8 place-items-center rounded-lg bg-[#e6f8ef] text-[#14a762] hover:bg-[#d2f2e1]" title="Approve"><Check size={16} /></button>
                        <button onClick={() => setStatus(x.id, "rejected")} className="grid h-8 w-8 place-items-center rounded-lg bg-[#ffebed] text-[#ed515d] hover:bg-[#ffd9dd]" title="Reject"><X size={16} /></button>
                      </div>
                    ) : <span className="text-xs text-stone-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
