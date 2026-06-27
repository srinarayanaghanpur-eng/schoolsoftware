"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { CheckCircle2, ClipboardList, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Exam = { id: string; name: string; className: string; section?: string; examType: string; startDate: string; maxMarks: number; status: string; academicYearId: string };
type Year = { id: string; name: string; isActive: boolean };

const TYPES = ["unit_test", "midterm", "final", "olympiad", "other"];
const statusTone: Record<string, string> = { scheduled: "bg-[#eef0ff] text-[#3033a1]", ongoing: "bg-[#fff4df] text-[#b8791a]", completed: "bg-[#e6f8ef] text-[#14a762]", published: "bg-[#e6f8ef] text-[#14a762]" };

export default function ExamsPage() {
  const { role } = useAdminSession();
  const canApprove = hasPermission(role, "exams.approve");
  const [exams, setExams] = useState<Exam[]>([]);
  const [years, setYears] = useState<Year[]>([]);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", academicYearId: "", className: "", section: "", examType: "unit_test", startDate: new Date().toISOString().slice(0, 10), maxMarks: "100" });

  async function load() {
    try {
      const [e, y] = await Promise.all([
        adminApiRequest<{ exams: Exam[] }>("/api/admin/exams"),
        adminApiRequest<{ years: Year[] }>("/api/admin/academic-years")
      ]);
      setExams(e.exams); setYears(y.years);
      const active = y.years.find((x) => x.isActive);
      if (active) setForm((f) => ({ ...f, academicYearId: f.academicYearId || active.id }));
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }
  useEffect(() => { void load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try { await adminApiRequest("/api/admin/exams", { method: "POST", body: JSON.stringify({ ...form, maxMarks: Number(form.maxMarks) }) }); setShow(false); await load(); }
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
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        {hasPermission(role, "exams.create") && <div className="flex justify-end"><button className="btn-primary" onClick={() => setShow((v) => !v)}>{show ? <X size={16} /> : <Plus size={16} />} New exam</button></div>}

        {show && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#303247]">Exam name<input className="field mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Unit Test 1" /></label>
            <label className="text-sm font-semibold text-[#303247]">Academic year<select className="field mt-1" required value={form.academicYearId} onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}><option value="">Select</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isActive ? " (active)" : ""}</option>)}</select></label>
            <label className="text-sm font-semibold text-[#303247]">Class<input className="field mt-1" required value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="10" /></label>
            <label className="text-sm font-semibold text-[#303247]">Section (optional)<input className="field mt-1" value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} placeholder="A" /></label>
            <label className="text-sm font-semibold text-[#303247]">Type<select className="field mt-1" value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select></label>
            <label className="text-sm font-semibold text-[#303247]">Start date<input className="field mt-1" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label className="text-sm font-semibold text-[#303247]">Max marks<input className="field mt-1" type="number" min="1" required value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: e.target.value })} /></label>
            <div className="sm:col-span-2"><button className="btn-primary">Create exam</button></div>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Exam</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Max</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody>
              {exams.length === 0 ? <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No exams scheduled yet</td></tr> : exams.map((x) => (
                <tr key={x.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-semibold text-[#303247]">{x.name}</td>
                  <td className="px-4 py-3">{x.className}{x.section}</td>
                  <td className="px-4 py-3 capitalize">{x.examType.replace("_", " ")}</td>
                  <td className="px-4 py-3 text-stone-500">{x.startDate}</td>
                  <td className="px-4 py-3">{x.maxMarks}</td>
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
