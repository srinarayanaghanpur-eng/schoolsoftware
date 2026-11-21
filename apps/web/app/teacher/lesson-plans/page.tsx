"use client";

import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS, CLASS_SELECTOR_CLASSES } from "@/lib/studentClasses";
import { useClassSections } from "@/lib/useClassSections";
import { auth } from "@sri-narayana/shared/firebase/client";
import { BookOpenCheck, Loader2, NotebookPen, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type LessonPlan = {
  id: string;
  className: string;
  section?: string;
  subject: string;
  topic: string;
  date: string;
  objectives?: string;
  teacherName?: string;
  status: string;
  createdBy?: string;
};

const statusStyles: Record<string, string> = {
  planned: "bg-[#eeefff] text-[#3033a1]",
  completed: "bg-[#e6f8ef] text-[#14a762]",
  reviewed: "bg-[#f3f4fb] text-[#6f7899]"
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherLessonPlansPage() {
  const { sectionsFor } = useClassSections();
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    className: "",
    section: "",
    subject: "",
    topic: "",
    date: today(),
    objectives: "",
    status: "planned"
  });

  const load = async () => {
    try {
      const data = await adminApiRequest<{ items: LessonPlan[] }>("/api/admin/masters/lesson-plans", undefined, { fresh: true });
      setPlans(data.items ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load lesson plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUid(auth.currentUser?.uid ?? "");
    void load();
  }, []);

  const mine = plans.filter((plan) => !uid || !plan.createdBy || plan.createdBy === uid);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await adminApiRequest("/api/admin/masters/lesson-plans", {
        method: "POST",
        body: JSON.stringify({ ...form, teacherName: auth.currentUser?.displayName ?? "" })
      });
      setShowForm(false);
      setForm({ ...form, topic: "", objectives: "" });
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to save lesson plan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plan: LessonPlan) => {
    if (!window.confirm(`Delete lesson plan "${plan.topic}"?`)) return;
    try {
      await adminApiRequest(`/api/admin/masters/lesson-plans/${plan.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to delete lesson plan");
    }
  };

  const sectionOptions = form.className ? sectionsFor(form.className) : [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8f9fd] px-4 py-6 md:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#6f7899]">Classroom</p>
          <h1 className="text-2xl font-black tracking-tight text-[#151a3c]">Lesson Plans</h1>
          <p className="mt-1 text-sm font-medium text-[#6f7899]">Plan what you teach, then mark it completed.</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-[#3033a1] px-4 py-2.5 text-sm font-bold text-white"
          onClick={() => setShowForm((value) => !value)}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Close" : "New plan"}
        </button>
      </header>

      {error && <div className="mb-4 rounded-2xl bg-[#ffeaec] px-4 py-3 text-sm font-bold text-[#dd5369]">{error}</div>}

      {showForm && (
        <form onSubmit={submit} className="mb-4 grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#e6e8f2] sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm font-bold text-[#151a3c]">
            Class
            <select className="mt-1 w-full rounded-xl border border-[#e6e8f2] px-3 py-2.5 text-sm font-semibold" required value={form.className} onChange={(event) => setForm({ ...form, className: event.target.value, section: "" })}>
              <option value="">Select class</option>
              {CLASS_SELECTOR_CLASSES.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-[#151a3c]">
            Section
            <select className="mt-1 w-full rounded-xl border border-[#e6e8f2] px-3 py-2.5 text-sm font-semibold" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })}>
              <option value="">All sections</option>
              {sectionOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-[#151a3c]">
            Subject
            <input className="mt-1 w-full rounded-xl border border-[#e6e8f2] px-3 py-2.5 text-sm font-semibold" required value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
          </label>
          <label className="text-sm font-bold text-[#151a3c]">
            Topic
            <input className="mt-1 w-full rounded-xl border border-[#e6e8f2] px-3 py-2.5 text-sm font-semibold" required value={form.topic} onChange={(event) => setForm({ ...form, topic: event.target.value })} />
          </label>
          <label className="text-sm font-bold text-[#151a3c]">
            Date
            <input type="date" className="mt-1 w-full rounded-xl border border-[#e6e8f2] px-3 py-2.5 text-sm font-semibold" required value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
          </label>
          <label className="text-sm font-bold text-[#151a3c]">
            Status
            <select className="mt-1 w-full rounded-xl border border-[#e6e8f2] px-3 py-2.5 text-sm font-semibold" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="planned">Planned</option>
              <option value="completed">Completed</option>
              <option value="reviewed">Reviewed</option>
            </select>
          </label>
          <label className="text-sm font-bold text-[#151a3c] sm:col-span-2 lg:col-span-3">
            Objectives
            <textarea className="mt-1 min-h-[70px] w-full rounded-xl border border-[#e6e8f2] px-3 py-2.5 text-sm font-semibold" value={form.objectives} onChange={(event) => setForm({ ...form, objectives: event.target.value })} />
          </label>
          <div className="flex justify-end sm:col-span-2 lg:col-span-3">
            <button className="rounded-xl bg-[#3033a1] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60" disabled={saving}>
              {saving ? "Saving…" : "Save lesson plan"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-[#3033a1]" /></div>
      ) : mine.length === 0 ? (
        <div className="rounded-3xl bg-white p-10 text-center text-sm font-semibold text-[#6f7899] ring-1 ring-[#e6e8f2]">
          <NotebookPen className="mx-auto mb-2" /> No lesson plans yet.
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {mine.map((plan) => (
            <li key={plan.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#e6e8f2]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#9aa2bd]">
                    {CLASS_LABELS[plan.className] ?? plan.className}{plan.section ? ` - ${plan.section}` : ""} · {plan.date}
                  </p>
                  <h2 className="mt-1 text-base font-black text-[#151a3c]">{plan.topic}</h2>
                  <p className="text-sm font-semibold text-[#6f7899]">{plan.subject}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${statusStyles[plan.status] ?? statusStyles.planned}`}>
                  {plan.status}
                </span>
              </div>
              {plan.objectives && <p className="mt-2 line-clamp-3 text-sm text-[#6f7899]">{plan.objectives}</p>}
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#9aa2bd]"><BookOpenCheck size={13} /> {plan.teacherName || "Me"}</span>
                <button type="button" className="text-xs font-bold text-[#dd5369]" onClick={() => void remove(plan)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
