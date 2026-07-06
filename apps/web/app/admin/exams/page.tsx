"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { CheckCircle2, ClipboardList, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type TimetableEntry = { subject: string; date: string; time: string; maxMarks?: string };
type Exam = { id: string; name: string; className: string; section?: string; examType: string; startDate: string; endDate?: string; maxMarks: number; status: string; academicYearId: string; timetable?: TimetableEntry[] };

const TYPES = ["unit_test", "midterm", "final", "olympiad", "other"];
const statusTone: Record<string, string> = { scheduled: "bg-[#eef0ff] text-[#3033a1]", ongoing: "bg-[#fff4df] text-[#b8791a]", completed: "bg-[#e6f8ef] text-[#14a762]", published: "bg-[#e6f8ef] text-[#14a762]" };

export default function ExamsPage() {
  const { role } = useAdminSession();
  const { years, selectedYear } = useAcademicYears();
  const canApprove = hasPermission(role, "exams.approve");
  const [exams, setExams] = useState<Exam[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [form, setForm] = useState({ name: "", academicYearId: "", className: "", section: "", examType: "unit_test", startDate: new Date().toISOString().slice(0, 10), endDate: "", maxMarks: "100" });

  async function load() {
    if (!selectedYear?.id) {
      setExams([]);
      return;
    }
    const academicYearId = selectedYear.id;
    try {
      const params = new URLSearchParams({ academicYearId, pageSize: "25" });
      const e = await adminApiRequest<{ exams: Exam[] }>(`/api/admin/exams?${params}`);
      setExams(e.exams);
      setForm((f) => ({ ...f, academicYearId: f.academicYearId || academicYearId }));
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }
  useEffect(() => { void load(); }, [selectedYear?.id]);

  function addTimetableRow() {
    setTimetable([...timetable, { subject: "", date: form.startDate, time: "", maxMarks: form.maxMarks }]);
  }
  function updateTimetableRow(i: number, field: string, value: string) {
    const updated = [...timetable];
    (updated[i] as Record<string, string>)[field] = value;
    setTimetable(updated);
  }
  function removeTimetableRow(i: number) {
    setTimetable(timetable.filter((_, idx) => idx !== i));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = { ...form, maxMarks: Number(form.maxMarks) };
      if (timetable.length > 0) {
        payload.timetable = timetable.map((t) => ({ ...t, maxMarks: t.maxMarks ? Number(t.maxMarks) : undefined }));
      }
      await adminApiRequest("/api/admin/exams", { method: "POST", body: JSON.stringify(payload) });
      setShow(false); setTimetable([]); await load();
    }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to create"); }
  }
  async function publish(id: string) {
    try { await adminApiRequest(`/api/admin/exams/${id}/publish`, { method: "POST" }); await load(); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed"); }
  }

  if (!hasPermission(role, "exams.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Exams & Marks" description="Schedule exams, enter marks, and publish results." />
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load exams.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        {hasPermission(role, "exams.create") && <div className="flex justify-end"><button className="btn-primary" onClick={() => setShow((v) => !v)}>{show ? <X size={16} /> : <Plus size={16} />} New exam</button></div>}

        {show && (
          <div>
            <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#303247]">Exam name<input className="field mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Unit Test 1" /></label>
              <label className="text-sm font-semibold text-[#303247]">Academic year<select className="field mt-1" required value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}><option value="">Select</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isActive ? " (active)" : ""}</option>)}</select></label>
              <label className="text-sm font-semibold text-[#303247]">Class<input className="field mt-1" required value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="10" /></label>
              <label className="text-sm font-semibold text-[#303247]">Section (optional)<input className="field mt-1" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" /></label>
              <label className="text-sm font-semibold text-[#303247]">Type<select className="field mt-1" value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select></label>
              <label className="text-sm font-semibold text-[#303247]">Start date<input className="field mt-1" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247]">End date (optional)<input className="field mt-1" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247]">Max marks<input className="field mt-1" type="number" min="1" required value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} /></label>
              <div className="sm:col-span-2 flex items-center gap-3">
                <button type="button" className="rounded-lg border border-[#e0e3f0] px-3 py-2 text-xs font-bold text-[#5d6690] hover:bg-[#f5f6fd]" onClick={() => setShowTimetable((v) => !v)}>
                  {showTimetable ? "Hide" : "Add"} timetable
                </button>
                <button className="btn-primary">Create exam</button>
              </div>
            </form>

            {showTimetable && (
              <div className="card mt-3 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-extrabold text-[#1f2136]">Exam Timetable</h4>
                  <button type="button" onClick={addTimetableRow} className="rounded-lg bg-[#eef0ff] px-2.5 py-1.5 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]"><Plus size={14} /> Add subject</button>
                </div>
                {timetable.length === 0 ? (
                  <p className="text-xs text-[#7d86a8]">No subjects added yet. The exam will use the default max marks.</p>
                ) : (
                  <div className="space-y-2">
                    {timetable.map((entry, i) => (
                      <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg bg-[#f8f8fc] p-3">
                        <label className="text-xs font-bold text-[#5d6690]">Subject<input className="field mt-0.5 !py-1.5 text-xs" value={entry.subject} onChange={(e) => updateTimetableRow(i, "subject", e.target.value)} placeholder="Maths" /></label>
                        <label className="text-xs font-bold text-[#5d6690]">Date<input className="field mt-0.5 !py-1.5 text-xs" type="date" value={entry.date} onChange={(e) => updateTimetableRow(i, "date", e.target.value)} /></label>
                        <label className="text-xs font-bold text-[#5d6690]">Time<input className="field mt-0.5 !py-1.5 text-xs" type="time" value={entry.time} onChange={(e) => updateTimetableRow(i, "time", e.target.value)} /></label>
                        <label className="text-xs font-bold text-[#5d6690]">Max<input className="field mt-0.5 !py-1.5 text-xs w-16" type="number" value={entry.maxMarks ?? ""} onChange={(e) => updateTimetableRow(i, "maxMarks", e.target.value)} placeholder={form.maxMarks} /></label>
                        <button type="button" onClick={() => removeTimetableRow(i)} className="rounded-lg p-1.5 text-[#ed515d] hover:bg-[#ffebed]"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Mobile: exam cards */}
        <div className="space-y-3 md:hidden">
          {exams.length === 0 ? (
            <div className="card p-8 text-center text-sm text-stone-400">No exams scheduled yet</div>
          ) : exams.map((x) => (
            <div key={x.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#303247]">{x.name}</p>
                  <p className="mt-0.5 text-xs font-medium capitalize text-stone-500">Class {x.className}{x.section} · {x.examType.replace("_", " ")}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusTone[x.status]}`}>{x.status}</span>
              </div>
              <p className="mt-2 text-xs font-medium text-stone-500">{x.startDate}{x.endDate ? ` – ${x.endDate}` : ""} · Max {x.maxMarks}{x.timetable?.length ? ` · ${x.timetable.length} subjects` : ""}</p>
              <div className="mt-3 flex gap-2">
                <Link href={`/admin/exams/${x.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#eef0ff] px-3 py-2.5 text-sm font-bold text-[#3033a1]"><ClipboardList size={15} /> Marks</Link>
                {x.status !== "published" && canApprove && <button onClick={() => publish(x.id)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#e6f8ef] px-3 py-2.5 text-sm font-bold text-[#14a762]"><CheckCircle2 size={15} /> Publish</button>}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop / tablet: table */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Max</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody>
              {exams.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No exams scheduled yet</td></tr> : exams.map((x) => (
                <tr key={x.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-semibold text-[#303247]">{x.name}</td>
                  <td className="px-4 py-3">{x.className}{x.section}</td>
                  <td className="px-4 py-3 capitalize">{x.examType.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-stone-500">{x.startDate}{x.endDate ? ` – ${x.endDate}` : ""}</td>
                  <td className="px-4 py-3">{x.maxMarks}{x.timetable?.length ? ` (${x.timetable.length} subjects)` : ""}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusTone[x.status]}`}>{x.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/admin/exams/${x.id}`} className="inline-flex items-center gap-1 rounded-lg bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]"><ClipboardList size={14} /> Marks</Link>
                      {x.status !== "published" && canApprove && <button onClick={() => publish(x.id)} className="inline-flex items-center gap-1 rounded-lg bg-[#e6f8ef] px-2.5 py-1 text-xs font-bold text-[#14a762] hover:bg-[#d2f2e1]"><CheckCircle2 size={14} /> Publish</button>}
                    </div>
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
