"use client";

import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS, CLASS_SELECTOR_CLASSES } from "@/lib/studentClasses";
import { useClassSections } from "@/lib/useClassSections";
import { auth } from "@sri-narayana/shared/firebase/client";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock,
  Plus,
  Send,
  X
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type AcademicYearOption = { id?: string; name: string; isActive: boolean };
type SubjectOption = { id: string; name: string; className?: string };
type HomeworkItem = {
  id: string;
  title: string;
  description?: string;
  subject: string;
  className: string;
  section?: string;
  assignedBy?: string;
  assignedDate: string;
  dueDate: string;
  status: string;
};

const statusStyles: Record<string, string> = {
  active: "bg-[#e6f8ef] text-[#14a762]",
  completed: "bg-[#eeefff] text-[#3033a1]",
  cancelled: "bg-[#ffeaec] text-[#dd5369]"
};

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function TeacherHomeworkPage() {
  const { sectionsFor } = useClassSections();
  const [years, setYears] = useState<AcademicYearOption[]>([]);
  const [yearId, setYearId] = useState("");
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [homework, setHomework] = useState<HomeworkItem[]>([]);
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject: "",
    className: "",
    section: "",
    assignedDate: isoDate(),
    dueDate: isoDate(2)
  });

  useEffect(() => {
    setUid(auth.currentUser?.uid ?? "");
    let active = true;
    void adminApiRequest<{ years: AcademicYearOption[] }>("/api/admin/academic-years")
      .then((data) => {
        if (!active) return;
        const list = data.years ?? [];
        setYears(list);
        const current = list.find((year) => year.isActive && year.id) ?? list.find((year) => year.id);
        setYearId(current?.id ?? "");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof AdminApiError ? err.message : "Unable to load academic years");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!yearId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ academicYearId: yearId, pageSize: "50" });
    void Promise.all([
      adminApiRequest<{ homework: HomeworkItem[] }>(`/api/admin/homework?${params}`),
      adminApiRequest<{ subjects: SubjectOption[] }>("/api/admin/subjects")
    ])
      .then(([homeworkData, subjectData]) => {
        if (!active) return;
        setHomework(homeworkData.homework ?? []);
        setSubjects(subjectData.subjects ?? []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof AdminApiError ? err.message : "Unable to load homework");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [yearId]);

  const myHomework = useMemo(
    () => (uid ? homework.filter((item) => item.assignedBy === uid) : homework),
    [homework, uid]
  );

  const subjectSuggestions = useMemo(() => {
    const forClass = subjects.filter((subject) => !subject.className || subject.className === form.className);
    return (forClass.length > 0 ? forClass : subjects).map((subject) => subject.name);
  }, [subjects, form.className]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!yearId || saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await adminApiRequest("/api/admin/homework", {
        method: "POST",
        body: JSON.stringify({ ...form, academicYearId: yearId })
      });
      const params = new URLSearchParams({ academicYearId: yearId, pageSize: "50" });
      const refreshed = await adminApiRequest<{ homework: HomeworkItem[] }>(
        `/api/admin/homework?${params}`,
        undefined,
        { fresh: true }
      );
      setHomework(refreshed.homework ?? []);
      setShowForm(false);
      setNotice("Homework assigned and parents notified.");
      setForm({
        title: "",
        description: "",
        subject: "",
        className: form.className,
        section: "",
        assignedDate: isoDate(),
        dueDate: isoDate(2)
      });
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to assign homework");
    } finally {
      setSaving(false);
    }
  };

  const sectionOptions = form.className ? sectionsFor(form.className) : [];

  return (
    <main className="min-h-screen bg-[#f5f6fd] text-[#1b1d32]">
      <section className="mx-auto max-w-[1440px] space-y-5 p-4 md:p-7">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-[#777fc4]">TEACHER WORKSPACE</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Homework</h1>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">
              Assign homework to a class or section. Parents get an instant push notification.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#3033a1] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#26287f] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => setShowForm((value) => !value)}
            disabled={!yearId}
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? "Close" : "Assign homework"}
          </button>
        </header>

        {error && (
          <div className="rounded-2xl border border-[#ffd7da] bg-[#fff7f7] p-4 text-sm font-semibold text-[#bf3345]">
            {error}
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-2 rounded-2xl border border-[#c9efdc] bg-[#f2fdf7] p-4 text-sm font-semibold text-[#128a51]">
            <CheckCircle2 size={16} /> {notice}
          </div>
        )}

        {!yearId && !loading && (
          <div className="rounded-2xl border border-[#ffe1a6] bg-[#fff8e8] p-4 text-sm font-semibold text-[#a76e08]">
            No academic year is active. Ask an administrator to set one up.
          </div>
        )}

        {showForm && (
          <form
            onSubmit={submit}
            className="grid gap-4 rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)] sm:grid-cols-2"
          >
            <label className="text-sm font-semibold text-[#353864]">
              Title
              <input
                className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                required
                maxLength={120}
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label className="text-sm font-semibold text-[#353864]">
              Academic year
              <select
                className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                required
                value={yearId}
                onChange={(event) => setYearId(event.target.value)}
              >
                {years.filter((year) => year.id).map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}{year.isActive ? " (active)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#353864]">
              Class
              <select
                className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                required
                value={form.className}
                onChange={(event) => setForm({ ...form, className: event.target.value, section: "" })}
              >
                <option value="">Select class</option>
                {CLASS_SELECTOR_CLASSES.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>
                    {classItem.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#353864]">
              Section
              <select
                className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                value={form.section}
                onChange={(event) => setForm({ ...form, section: event.target.value })}
                disabled={sectionOptions.length === 0}
              >
                <option value="">All sections</option>
                {sectionOptions.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#353864]">
              Subject
              <input
                className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                required
                list="teacher-homework-subjects"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Mathematics"
              />
              <datalist id="teacher-homework-subjects">
                {subjectSuggestions.map((subject) => (
                  <option key={subject} value={subject} />
                ))}
              </datalist>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-semibold text-[#353864]">
                Assigned
                <input
                  className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                  type="date"
                  required
                  value={form.assignedDate}
                  onChange={(event) => setForm({ ...form, assignedDate: event.target.value })}
                />
              </label>
              <label className="text-sm font-semibold text-[#353864]">
                Due
                <input
                  className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm font-semibold text-[#353864]">
                Instructions
                <textarea
                  className="mt-1 w-full rounded-xl border border-[#e0e3f0] bg-[#fbfbfe] px-3 py-2.5 text-sm font-medium outline-none focus:border-[#9aa0e6]"
                  rows={3}
                  required
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Solve exercises 1–10 from chapter 4."
                />
              </label>
            </div>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <button
                type="button"
                className="rounded-xl border border-[#e0e3f0] bg-white px-4 py-2.5 text-sm font-bold text-[#353864] hover:bg-[#f4f5fb]"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-[#3033a1] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#26287f] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saving || !yearId}
              >
                <Send size={16} /> {saving ? "Assigning…" : "Assign"}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="grid place-items-center rounded-2xl border border-[#e3e6f0] bg-white p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3033a1] border-t-transparent" />
          </div>
        ) : myHomework.length === 0 ? (
          <div className="rounded-2xl border border-[#e3e6f0] bg-white p-8 text-center text-sm font-medium text-[#7d86a8]">
            You have not assigned any homework{yearId ? " this academic year" : ""} yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {myHomework.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-[#e3e6f0] bg-white p-4 shadow-[0_2px_4px_rgba(36,42,94,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(36,42,94,0.09)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-extrabold text-[#1b1d32]">{item.title}</h2>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-[#7d86a8]">
                      <BookOpen size={12} /> {item.subject} · {CLASS_LABELS[item.className] ?? item.className}
                      {item.section ? ` - ${item.section}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[item.status] ?? "bg-[#f1f2fa] text-[#4d5096]"}`}>
                    {item.status}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-[#5c6484]">{item.description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-[#7d86a8]">
                  <span className="flex items-center gap-1"><CalendarDays size={12} /> {item.assignedDate}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> Due {item.dueDate}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="text-xs font-medium text-[#9aa2bd]">
          Only homework you assigned is listed. Each new assignment sends one push notification to the parents of the target class.
        </p>
      </section>
    </main>
  );
}
