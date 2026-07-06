"use client";

import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { DatePicker } from "@/components/DatePicker";
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";
import { HandCoins, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type StaffOption = { id: string; fullName: string; employeeId?: string };
type Advance = { id: string; teacherId: string; teacherName?: string; amount: number; date: string; reason?: string; recovered?: boolean };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

/** Record and list salary advances (loans) paid to staff against their salary. */
export function SalaryAdvancesPanel() {
  const { role } = useAdminSession();
  const canCreate = Boolean(role && hasPermission(role, "payroll.create"));
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ teacherId: "", amount: "", date: new Date().toISOString().slice(0, 10), reason: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [t, a] = await Promise.all([
        adminApiRequest<{ teachers: StaffOption[] }>("/api/admin/teachers"),
        adminApiRequest<{ advances: Advance[] }>("/api/admin/finance/advances")
      ]);
      setStaff(t.teachers);
      setAdvances(a.advances);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load advances"); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await adminApiRequest("/api/admin/finance/advances", {
        method: "POST",
        body: JSON.stringify({ teacherId: form.teacherId, amount: Number(form.amount), date: form.date, reason: form.reason })
      });
      setForm({ teacherId: "", amount: "", date: new Date().toISOString().slice(0, 10), reason: "" });
      setShow(false);
      await load();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to record advance"); }
    finally { setSaving(false); }
  }

  const totalOutstanding = advances.filter((a) => !a.recovered).reduce((s, a) => s + (a.amount || 0), 0);

  return (
    <article className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff0e0] text-[#d27a14]"><HandCoins size={18} /></span>
          <div>
            <h2 className="font-bold text-[#1f2136]">Salary Advances</h2>
            <p className="text-xs font-medium text-[#7d86a8]">Loans paid to staff against their salary · Outstanding {inr(totalOutstanding)}</p>
          </div>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShow((v) => !v)}>{show ? <X size={16} /> : <Plus size={16} />} Give advance</button>
        )}
      </div>

      {error && <div className="mx-4 mb-3 rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-2 text-sm font-semibold text-[#c83f4d]">{error}</div>}

      {show && canCreate && (
        <form onSubmit={submit} className="grid gap-3 border-t border-stone-100 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <select className="field" required value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
            <option value="">Select staff</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}{s.employeeId ? ` (${s.employeeId})` : ""}</option>)}
          </select>
          <input className="field" type="number" min="1" placeholder="Amount ₹" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <DatePicker required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="field" placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          <button className="btn-primary sm:col-span-2 xl:col-span-4" disabled={saving}>{saving ? "Saving..." : "Record advance"}</button>
        </form>
      )}

      <div className="overflow-x-auto border-t border-stone-100">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Staff</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody>
            {advances.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No advances recorded yet.</td></tr>
            ) : advances.map((a) => (
              <tr key={a.id} className="border-t border-stone-100">
                <td className="px-4 py-3 text-stone-500">{a.date}</td>
                <td className="px-4 py-3 font-semibold text-[#303247]">{a.teacherName || a.teacherId}</td>
                <td className="px-4 py-3 text-right font-bold text-[#d27a14]">{inr(a.amount)}</td>
                <td className="px-4 py-3 text-stone-500">{a.reason || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${a.recovered ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#fff4df] text-[#b8791a]"}`}>{a.recovered ? "Recovered" : "Outstanding"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
