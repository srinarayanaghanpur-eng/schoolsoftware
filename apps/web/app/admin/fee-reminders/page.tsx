"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Bell, Plus, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Reminder = { id: string; studentId: string; studentName: string; className: string; amount: number; dueDate: string; note: string; sent: boolean; createdAt: string };
type Student = { id: string; studentName: string; admissionNumber: string };

export default function FeeRemindersPage() {
  const { role } = useAdminSession();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [form, setForm] = useState({ studentId: "", studentName: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), note: "" });

  async function load() {
    try {
      const [r, s] = await Promise.all([
        adminApiRequest<{ reminders: Reminder[] }>("/api/admin/fee-reminders"),
        adminApiRequest<{ data?: Student[] }>("/api/admin/students")
      ]);
      setReminders(r.reminders);
      setStudents(s.data || []);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }
  useEffect(() => { void load(); }, []);

  function selectStudent(student: Student) {
    setForm({ ...form, studentId: student.id, studentName: student.studentName });
    setStudentSearch("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!form.studentId) { setError("Select a student"); return; }
    try {
      await adminApiRequest("/api/admin/fee-reminders", {
        method: "POST",
        body: JSON.stringify({ studentId: form.studentId, amount: Number(form.amount), dueDate: form.dueDate, note: form.note })
      });
      setForm({ studentId: "", studentName: "", amount: "", dueDate: new Date().toISOString().slice(0, 10), note: "" });
      setShow(false); await load();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to create"); }
  }

  const filteredStudents = students.filter((s) =>
    !studentSearch || s.studentName?.toLowerCase().includes(studentSearch.toLowerCase()) || s.admissionNumber?.includes(studentSearch)
  ).slice(0, 10);

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Fee Reminders" description="Create and manage fee reminders for students." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        <div className="flex justify-end">
          <button className="btn-primary" onClick={() => setShow((v) => !v)}>{show ? <X size={16} /> : <Plus size={16} />} New reminder</button>
        </div>

        {show && (
          <form onSubmit={submit} className="card space-y-4 p-5">
            <div className="relative">
              <label className="text-sm font-semibold text-[#303247]">Student</label>
              {form.studentName ? (
                <div className="mt-1 flex items-center gap-2 rounded-xl bg-[#eef0ff] px-3 py-2 text-sm font-semibold text-[#3033a1]">
                  {form.studentName}
                  <button type="button" onClick={() => setForm({ ...form, studentId: "", studentName: "" })} className="ml-auto text-[#ed515d]"><X size={14} /></button>
                </div>
              ) : (
                <>
                  <input className="field mt-1" placeholder="Search students..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
                  {studentSearch && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-[#e0e3f0] bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredStudents.map((s) => (
                        <button key={s.id} type="button" onClick={() => selectStudent(s)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-[#f5f6fd]">{s.studentName} ({s.admissionNumber})</button>
                      ))}
                      {filteredStudents.length === 0 && <div className="px-3 py-2 text-xs text-[#7d86a8]">No students found</div>}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-sm font-semibold text-[#303247]">Amount<input className="field mt-1" type="number" min="1" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247]">Due date<input className="field mt-1" type="date" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247]">Note (optional)<input className="field mt-1" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
            </div>
            <button className="btn-primary"><Bell size={16} /> Create reminder</button>
          </form>
        )}

        {/* Mobile: reminder cards */}
        <div className="space-y-3 md:hidden">
          {reminders.length === 0 ? (
            <div className="card p-8 text-center text-sm text-stone-400">No reminders yet</div>
          ) : reminders.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#303247]">{r.studentName}</p>
                  <p className="mt-0.5 text-xs font-medium text-stone-500">Class {r.className} · Due {r.dueDate}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${r.sent ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#fff4df] text-[#b8791a]"}`}>{r.sent ? "Sent" : "Draft"}</span>
              </div>
              <p className="mt-2 text-lg font-extrabold text-[#ed515d]">₹{r.amount}</p>
            </div>
          ))}
        </div>

        {/* Desktop / tablet: table */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr>
              <th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Status</th>
            </tr></thead>
            <tbody>
              {reminders.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No reminders yet</td></tr> : reminders.map((r) => (
                <tr key={r.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-semibold text-[#303247]">{r.studentName}</td>
                  <td className="px-4 py-3">{r.className}</td>
                  <td className="px-4 py-3 text-[#ed515d] font-bold">₹{r.amount}</td>
                  <td className="px-4 py-3">{r.dueDate}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.sent ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#fff4df] text-[#b8791a]"}`}>
                      {r.sent ? "Sent" : "Draft"}
                    </span>
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
