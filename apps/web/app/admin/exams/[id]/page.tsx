"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Exam = { id: string; name: string; className: string; section?: string; maxMarks: number };
type Student = { id: string; studentName?: string; class?: string; section?: string };
type Mark = { studentId: string; subject: string; marksObtained: number };

export default function MarksEntryPage({ params }: { params: { id: string } }) {
  const { role } = useAdminSession();
  const canEdit = hasPermission(role, "exams.edit");
  const [exam, setExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subject, setSubject] = useState("Maths");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await adminApiRequest<{ exam: Exam }>(`/api/admin/exams/${params.id}`);
        setExam(e.exam);
        let studs: Student[] = [];
        try { const r = await adminApiRequest<{ data?: Student[]; students?: Student[] }>("/api/admin/students"); studs = r.data || r.students || []; } catch { /* optional */ }
        setStudents(studs.filter((s) => !e.exam.className || String(s.class) === String(e.exam.className)));
      } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    })();
  }, [params.id]);

  // load existing marks for the chosen subject
  useEffect(() => {
    (async () => {
      try {
        const r = await adminApiRequest<{ marks: Mark[] }>(`/api/admin/exams/${params.id}/marks`);
        const m: Record<string, string> = {};
        r.marks.filter((x) => x.subject === subject).forEach((x) => { m[x.studentId] = String(x.marksObtained); });
        setMarks(m);
      } catch { /* none yet */ }
    })();
  }, [params.id, subject]);

  async function save() {
    if (!exam) return;
    setSaving(true); setError(""); setMsg("");
    try {
      const payload = Object.entries(marks).filter(([, v]) => v !== "").map(([studentId, v]) => ({ studentId, subject, marksObtained: Number(v), maxMarks: exam.maxMarks }));
      if (payload.length === 0) { setError("Enter at least one mark."); setSaving(false); return; }
      const r = await adminApiRequest<{ saved: number }>(`/api/admin/exams/${params.id}/marks`, { method: "POST", body: JSON.stringify({ marks: payload }) });
      setMsg(`Saved ${r.saved} mark(s) for ${subject}.`);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to save"); }
    finally { setSaving(false); }
  }

  if (!hasPermission(role, "exams.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title={exam ? `Marks · ${exam.name}` : "Marks"} description={exam ? `Class ${exam.className}${exam.section || ""} · max ${exam.maxMarks}` : ""} />
      <section className="space-y-4 p-4 md:p-7">
        <Link href="/admin/exams" className="text-sm font-semibold text-[#3033a1] hover:underline">← Back to exams</Link>
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        {msg && <div className="card border-l-4 border-l-[#14a762] p-4 text-sm font-semibold text-[#14a762]">{msg}</div>}

        <div className="card flex flex-wrap items-end gap-3 p-4">
          <label className="text-sm font-semibold text-[#303247]">Subject<input className="field mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
          {canEdit && <button className="btn-primary ml-auto" onClick={save} disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save marks"}</button>}
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3 w-40">Marks (/{exam?.maxMarks ?? "—"})</th></tr></thead>
            <tbody>
              {students.length === 0 ? <tr><td colSpan={2} className="px-4 py-8 text-center text-stone-400">No students in this class</td></tr> : students.map((s) => (
                <tr key={s.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-semibold text-[#303247]">{s.studentName}</td>
                  <td className="px-4 py-2"><input className="field !py-1.5" type="number" min="0" max={exam?.maxMarks} disabled={!canEdit} value={marks[s.id] ?? ""} onChange={(e) => setMarks({ ...marks, [s.id]: e.target.value })} placeholder="—" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
