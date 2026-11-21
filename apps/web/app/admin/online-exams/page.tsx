"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { usePopup } from "@/components/CenterPopup";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_SELECTOR_CLASSES, SECTION_OPTIONS } from "@/lib/studentClasses";
import { hasPermission, formatLabel } from "@sri-narayana/shared";
import { BarChart3, CheckCircle2, Loader2, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Question = { id?: string; prompt: string; options: string[]; correctIndex: number; marks: string };
type OnlineExam = {
  id: string;
  title: string;
  description?: string;
  academicYearId: string;
  className: string;
  section?: string;
  subject?: string;
  durationMinutes: number;
  startAt?: string;
  endAt?: string;
  status: string;
  negativeMarking?: number;
  questionCount: number;
  totalMarks: number;
  window?: "not_started" | "open" | "closed";
  questions?: Question[];
};
type Attempt = { id: string; studentName: string; admissionNumber: string; className: string; section: string; obtainedMarks: number; totalMarks: number; percent: number; correct: number; wrong: number; unanswered: number };
type Results = { attempts: Attempt[]; totalMarks: number; average: number; truncated: boolean };

const statusTone: Record<string, string> = {
  draft: "bg-[#eef0ff] text-[#3033a1]",
  published: "bg-[#e6f8ef] text-[#14a762]",
  closed: "bg-stone-100 text-stone-500"
};

function blankQuestion(): Question {
  return { prompt: "", options: ["", "", "", ""], correctIndex: 0, marks: "1" };
}

function blankForm(academicYearId: string) {
  return {
    title: "",
    description: "",
    academicYearId,
    className: "",
    section: "",
    subject: "",
    durationMinutes: "30",
    startAt: "",
    endAt: "",
    negativeMarking: "0"
  };
}

export default function OnlineExamsPage() {
  const { role } = useAdminSession();
  const { years, selectedYear } = useAcademicYears();
  const toast = usePopup();
  const notify = (message: string, kind: "success" | "error") => (kind === "success" ? toast.success(message) : toast.error(message));
  const canCreate = hasPermission(role, "exams.create");
  const canEdit = hasPermission(role, "exams.edit");
  const canDelete = hasPermission(role, "exams.delete");
  const canView = hasPermission(role, "exams.view");

  const [exams, setExams] = useState<OnlineExam[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [editId, setEditId] = useState("");
  const [form, setForm] = useState(blankForm(""));
  const [questions, setQuestions] = useState<Question[]>([blankQuestion()]);
  const [classFilter, setClassFilter] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [resultsExam, setResultsExam] = useState<OnlineExam | null>(null);

  async function load() {
    if (!selectedYear?.id) {
      setExams([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "100" });
      if (classFilter) params.set("className", classFilter);
      const response = await adminApiRequest<{ exams: OnlineExam[] }>(`/api/admin/online-exams?${params.toString()}`);
      setExams(response.exams ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load online exams");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    setForm((current) => ({ ...current, academicYearId: current.academicYearId || selectedYear?.id || "" }));
  }, [selectedYear?.id, classFilter]);

  function openCreate() {
    setEditId("");
    setForm(blankForm(selectedYear?.id ?? ""));
    setQuestions([blankQuestion()]);
    setShow(true);
    setError("");
  }

  function openEdit(exam: OnlineExam) {
    setEditId(exam.id);
    setForm({
      title: exam.title,
      description: exam.description ?? "",
      academicYearId: exam.academicYearId,
      className: exam.className,
      section: exam.section ?? "",
      subject: exam.subject ?? "",
      durationMinutes: String(exam.durationMinutes || 30),
      startAt: exam.startAt ?? "",
      endAt: exam.endAt ?? "",
      negativeMarking: String(exam.negativeMarking ?? 0)
    });
    setQuestions(
      (exam.questions ?? []).map((question) => ({
        id: question.id,
        prompt: question.prompt,
        options: question.options.length >= 2 ? question.options : [...question.options, "", "", "", ""].slice(0, 4),
        correctIndex: question.correctIndex,
        marks: String(question.marks ?? 1)
      }))
    );
    setShow(true);
    setError("");
  }

  function updateQuestion(index: number, patch: Partial<Question>) {
    setQuestions((current) => current.map((question, i) => (i === index ? { ...question, ...patch } : question)));
  }
  function updateOption(index: number, optionIndex: number, value: string) {
    setQuestions((current) =>
      current.map((question, i) => {
        if (i !== index) return question;
        const options = [...question.options];
        options[optionIndex] = value;
        return { ...question, options };
      })
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const cleaned = questions
      .map((question) => ({
        ...question,
        prompt: question.prompt.trim(),
        options: question.options.map((option) => option.trim()).filter(Boolean),
        marks: Number(question.marks) || 1
      }))
      .filter((question) => question.prompt);
    if (cleaned.length === 0) {
      notify("Add at least one question with text.", "error");
      return;
    }
    if (cleaned.some((question) => question.options.length < 2)) {
      notify("Every question needs at least two options.", "error");
      return;
    }
    if (cleaned.some((question) => question.correctIndex >= question.options.length)) {
      notify("Pick a valid correct option for each question.", "error");
      return;
    }

    const payload = {
      ...form,
      durationMinutes: Number(form.durationMinutes) || 30,
      negativeMarking: Number(form.negativeMarking) || 0,
      questions: cleaned
    };
    try {
      if (editId) {
        await adminApiRequest(`/api/admin/online-exams/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await adminApiRequest("/api/admin/online-exams", { method: "POST", body: JSON.stringify({ ...payload, status: "draft" }) });
      }
      notify(editId ? "Online exam updated." : "Online exam created as draft.", "success");
      setShow(false);
      setEditId("");
      await load();
    } catch (err) {
      notify(err instanceof AdminApiError ? err.message : "Failed to save online exam", "error");
    }
  }

  async function setStatus(exam: OnlineExam, status: "published" | "closed" | "draft") {
    try {
      await adminApiRequest(`/api/admin/online-exams/${exam.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      notify(status === "published" ? "Exam published to the portal." : "Exam updated.", "success");
      await load();
    } catch (err) {
      notify(err instanceof AdminApiError ? err.message : "Failed to update exam", "error");
    }
  }

  async function remove(exam: OnlineExam) {
    if (!window.confirm(`Delete "${exam.title}" and all its attempts?`)) return;
    try {
      await adminApiRequest(`/api/admin/online-exams/${exam.id}`, { method: "DELETE" });
      notify("Online exam deleted.", "success");
      await load();
    } catch (err) {
      notify(err instanceof AdminApiError ? err.message : "Failed to delete exam", "error");
    }
  }

  async function openResults(exam: OnlineExam) {
    setResultsExam(exam);
    setResults(null);
    try {
      const response = await adminApiRequest<Results>(`/api/admin/online-exams/${exam.id}/results?pageSize=500`);
      setResults(response);
    } catch (err) {
      notify(err instanceof AdminApiError ? err.message : "Failed to load results", "error");
    }
  }

  if (!canView) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Online Exams" description="Build MCQ tests, publish them to the parent portal and review auto-graded results." />
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to manage online exams.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="card flex flex-wrap items-end justify-between gap-3 p-4">
          <label className="text-sm font-semibold text-[#303247]">
            Class filter
            <select className="field mt-1 min-w-44" value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
              <option value="">All classes</option>
              {CLASS_SELECTOR_CLASSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          {canCreate && <button type="button" className="btn-primary" onClick={openCreate} disabled={!selectedYear?.id}><Plus size={16} /> New online exam</button>}
        </div>

        {show && (
          <form onSubmit={submit} className="card space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-[#1f2136]">{editId ? "Edit online exam" : "New online exam"}</h3>
              <button type="button" className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-stone-100" onClick={() => { setShow(false); setEditId(""); }}><X size={18} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-[#303247]">Title<input className="field mt-1" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Unit Test 1 - Science" /></label>
              <label className="text-sm font-semibold text-[#303247]">Academic year<select className="field mt-1" required value={form.academicYearId} onChange={(event) => setForm({ ...form, academicYearId: event.target.value })}><option value="">Select</option>{years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isActive ? " (active)" : ""}</option>)}</select></label>
              <label className="text-sm font-semibold text-[#303247]">Class<select className="field mt-1" required value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value })}><option value="">Select class</option>{CLASS_SELECTOR_CLASSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="text-sm font-semibold text-[#303247]">Section (optional)<select className="field mt-1" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })}><option value="">All sections</option>{SECTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="text-sm font-semibold text-[#303247]">Subject<input className="field mt-1" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Science" /></label>
              <label className="text-sm font-semibold text-[#303247]">Duration (minutes)<input className="field mt-1" type="number" min="5" max="300" value={form.durationMinutes} onChange={(event) => setForm({ ...form, durationMinutes: event.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247]">Starts at (optional)<input className="field mt-1" type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247]">Ends at (optional)<input className="field mt-1" type="datetime-local" value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247]">Negative marking per wrong answer (0–1)<input className="field mt-1" type="number" min="0" max="1" step="0.25" value={form.negativeMarking} onChange={(event) => setForm({ ...form, negativeMarking: event.target.value })} /></label>
              <label className="text-sm font-semibold text-[#303247] sm:col-span-2">Instructions<textarea className="field mt-1" rows={2} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Read each question carefully. One attempt only." /></label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-extrabold text-[#1f2136]">Questions ({questions.length})</h4>
                <button type="button" className="rounded-lg bg-[#eef0ff] px-2.5 py-1.5 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]" onClick={() => setQuestions((current) => [...current, blankQuestion()])}><Plus size={14} /> Add question</button>
              </div>
              {questions.map((question, index) => (
                <div key={index} className="rounded-xl border border-[#e0e3f0] bg-[#fafbff] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-bold text-[#7d86a8]">Question {index + 1}</span>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-[#5d6690]">Marks<input className="field ml-1 inline-block w-16 !py-1 text-xs" type="number" min="1" value={question.marks} onChange={(event) => updateQuestion(index, { marks: event.target.value })} /></label>
                      <button type="button" className="rounded-lg p-1.5 text-[#ed515d] hover:bg-[#ffebed]" onClick={() => setQuestions((current) => current.filter((_, i) => i !== index))} disabled={questions.length === 1}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <textarea className="field" rows={2} required value={question.prompt} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} placeholder="Type the question" />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {question.options.map((option, optionIndex) => (
                      <label key={optionIndex} className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-[#5d6690]">
                        <input type="radio" name={`correct-${index}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuestion(index, { correctIndex: optionIndex })} />
                        <input className="field !py-1.5 text-xs" value={option} onChange={(event) => updateOption(index, optionIndex, event.target.value)} placeholder={`Option ${optionIndex + 1}`} />
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] font-medium text-[#7d86a8]">Select the radio button next to the correct option. Blank options are ignored.</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="btn-primary"><CheckCircle2 size={16} /> {editId ? "Save changes" : "Create draft"}</button>
              <button type="button" className="btn-secondary" onClick={() => { setShow(false); setEditId(""); }}>Cancel</button>
            </div>
          </form>
        )}

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Questions</th><th className="px-4 py-3">Marks</th><th className="px-4 py-3">Duration</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400"><Loader2 className="mx-auto animate-spin" size={20} /></td></tr>
              ) : exams.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">No online exams yet. Create one to get started.</td></tr>
              ) : exams.map((exam) => (
                <tr key={exam.id} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-semibold text-[#303247]">{exam.title}</td>
                  <td className="px-4 py-3">{exam.className}{exam.section ? `-${exam.section}` : ""}</td>
                  <td className="px-4 py-3">{exam.subject || "—"}</td>
                  <td className="px-4 py-3">{exam.questionCount}</td>
                  <td className="px-4 py-3">{exam.totalMarks}</td>
                  <td className="px-4 py-3">{exam.durationMinutes} min</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusTone[exam.status] ?? statusTone.draft}`}>{formatLabel(exam.status)}</span>
                    {exam.status === "published" && exam.window && (
                      <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">
                        {exam.window === "open" ? "Open now" : exam.window === "not_started" ? "Scheduled" : "Closed"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canEdit && <button type="button" onClick={() => openEdit(exam)} className="inline-flex items-center gap-1 rounded-lg bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]"><Pencil size={13} /> Edit</button>}
                      {canEdit && exam.status !== "published" && <button type="button" onClick={() => void setStatus(exam, "published")} className="inline-flex items-center gap-1 rounded-lg bg-[#e6f8ef] px-2.5 py-1 text-xs font-bold text-[#14a762] hover:bg-[#d2f2e1]"><Send size={13} /> Publish</button>}
                      {canEdit && exam.status === "published" && <button type="button" onClick={() => void setStatus(exam, "closed")} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-bold text-stone-600 hover:bg-stone-200">Close</button>}
                      <button type="button" onClick={() => void openResults(exam)} className="inline-flex items-center gap-1 rounded-lg bg-[#fff4df] px-2.5 py-1 text-xs font-bold text-[#b8791a] hover:bg-[#ffe9c2]"><BarChart3 size={13} /> Results</button>
                      {canDelete && <button type="button" onClick={() => void remove(exam)} className="rounded-lg p-1.5 text-[#ed515d] hover:bg-[#ffebed]"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {resultsExam && (
          <div className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1f2136]">Results · {resultsExam.title}</h3>
                {results && <p className="text-xs font-semibold text-[#7d86a8]">{results.attempts.length} attempt(s) · Average {results.average}% · Max {results.totalMarks}</p>}
              </div>
              <button type="button" className="rounded-lg p-1.5 text-[#7d86a8] hover:bg-stone-100" onClick={() => { setResultsExam(null); setResults(null); }}><X size={18} /></button>
            </div>
            {!results ? (
              <p className="text-sm font-semibold text-[#7d86a8]"><Loader2 className="inline animate-spin" size={15} /> Loading results...</p>
            ) : results.attempts.length === 0 ? (
              <p className="text-sm font-semibold text-[#7d86a8]">No attempts submitted yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-3 py-2">Student</th><th className="px-3 py-2">Class</th><th className="px-3 py-2">Score</th><th className="px-3 py-2">%</th><th className="px-3 py-2">Correct</th><th className="px-3 py-2">Wrong</th><th className="px-3 py-2">Skipped</th></tr></thead>
                  <tbody>
                    {results.attempts.map((attempt) => (
                      <tr key={attempt.id} className="border-t border-stone-100">
                        <td className="px-3 py-2 font-semibold text-[#303247]">{attempt.studentName || attempt.admissionNumber}</td>
                        <td className="px-3 py-2">{attempt.className}{attempt.section ? `-${attempt.section}` : ""}</td>
                        <td className="px-3 py-2">{attempt.obtainedMarks} / {attempt.totalMarks}</td>
                        <td className="px-3 py-2">{attempt.percent}%</td>
                        <td className="px-3 py-2">{attempt.correct}</td>
                        <td className="px-3 py-2">{attempt.wrong}</td>
                        <td className="px-3 py-2">{attempt.unanswered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}
