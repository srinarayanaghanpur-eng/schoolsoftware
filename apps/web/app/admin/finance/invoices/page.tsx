"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Invoice = { id: string; invoiceNo: string; studentName?: string; total: number; status: string; date: string };
type Student = { id: string; studentName?: string; class?: string };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function InvoicesPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [items, setItems] = useState([{ name: "Tuition Fee", amount: "" }]);

  async function load() {
    if (!selectedYear?.id) {
      setInvoices([]);
      setStudents([]);
      return;
    }
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "25" });
      const inv = await adminApiRequest<{ invoices: Invoice[] }>(`/api/admin/finance/invoices?${params}`);
      setInvoices(inv.invoices);
      let studs: Student[] = [];
      try { const r = await adminApiRequest<{ data?: Student[]; students?: Student[] }>(`/api/admin/students?${params}`); studs = r.data || r.students || []; } catch { /* students optional */ }
      setStudents(studs);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }
  useEffect(() => { void load(); }, [selectedYear?.id]);

  const total = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selectedYear?.id) { setError("Select an academic year first."); return; }
    try {
      await adminApiRequest("/api/admin/finance/invoices", { method: "POST", body: JSON.stringify({ studentId, academicYearId: selectedYear.id, items: items.filter((i) => i.name && i.amount).map((i) => ({ name: i.name, amount: Number(i.amount) })) }) });
      setShow(false); setStudentId(""); setItems([{ name: "Tuition Fee", amount: "" }]); await load();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to create"); }
  }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Invoices" description="Generate student fee invoices with auto numbers." />
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load invoices.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex justify-end"><button className="btn-primary" onClick={() => setShow((v) => !v)}>{show ? <X size={16} /> : <Plus size={16} />} New invoice</button></div>

        {show && (
          <form onSubmit={submit} className="card space-y-4 p-5">
            <label className="block text-sm font-semibold text-[#303247]">Student
              <select className="field mt-1" required value={studentId} onChange={(e) => setStudentId(e.target.value)}><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.studentName} {s.class ? `(Class ${s.class})` : ""}</option>)}</select>
            </label>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex gap-2">
                  <input className="field flex-1" placeholder="Item (e.g. Tuition Fee)" value={it.name} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                  <input className="field w-32" type="number" min="0" placeholder="Amount" value={it.amount} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))} />
                  {items.length > 1 && <button type="button" onClick={() => setItems(items.filter((_, j) => j !== i))} className="grid w-9 place-items-center rounded-md text-[#ed515d] hover:bg-[#ffebed]"><Trash2 size={16} /></button>}
                </div>
              ))}
              <button type="button" onClick={() => setItems([...items, { name: "", amount: "" }])} className="text-sm font-semibold text-[#3033a1] hover:underline">+ Add line item</button>
            </div>
            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <span className="text-sm font-bold text-[#1f2136]">Total: <span className="text-[#14a762]">{inr(total)}</span></span>
              <button className="btn-primary" disabled={!studentId || total <= 0}>Generate invoice</button>
            </div>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Invoice #</th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody>
              {invoices.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No invoices yet</td></tr> : invoices.map((x) => (
                <tr key={x.id} className="border-t border-stone-100"><td className="px-4 py-3 font-bold text-[#3033a1]">{x.invoiceNo}</td><td className="px-4 py-3">{x.studentName}</td><td className="px-4 py-3 text-stone-500">{x.date}</td><td className="px-4 py-3 text-right font-semibold">{inr(x.total)}</td><td className="px-4 py-3"><span className="rounded-full bg-[#eef0ff] px-2 py-0.5 text-xs font-bold text-[#3033a1]">{formatLabel(x.status)}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
