"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_SELECTOR_CLASSES, CLASS_LABELS } from "@/lib/studentClasses";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Subject = { id: string; name: string; code?: string; className?: string };
type Period = { id: string; label: string; startTime: string; endTime: string; order: number };

export default function AcademicsPage() {
  const { role } = useAdminSession();
  const toast = usePopup();
  const canCreate = hasPermission(role, "academics.create");
  const canEdit = hasPermission(role, "academics.edit");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", className: "" });
  const [periodForm, setPeriodForm] = useState({ label: "", startTime: "09:00", endTime: "09:45", order: "1" });
  const [showSubject, setShowSubject] = useState(false);
  const [showPeriod, setShowPeriod] = useState(false);

  async function load() {
    try {
      const [s, p] = await Promise.all([
        adminApiRequest<{ subjects: Subject[] }>("/api/admin/subjects"),
        adminApiRequest<{ periods: Period[] }>("/api/admin/periods")
      ]);
      setSubjects(s.subjects);
      setPeriods(p.periods);
    } catch (error) {
      toast.error("Failed to load academics", error instanceof AdminApiError ? error.message : undefined);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addSubject(event: FormEvent) {
    event.preventDefault();
    try {
      await adminApiRequest("/api/admin/subjects", {
        method: "POST",
        body: JSON.stringify(subjectForm)
      });
      setSubjectForm({ name: "", code: "", className: "" });
      setShowSubject(false);
      toast.success("Subject added");
      await load();
    } catch (error) {
      toast.error("Failed to add subject", error instanceof AdminApiError ? error.message : undefined);
    }
  }

  async function addPeriod(event: FormEvent) {
    event.preventDefault();
    try {
      await adminApiRequest("/api/admin/periods", {
        method: "POST",
        body: JSON.stringify({ ...periodForm, order: Number(periodForm.order) })
      });
      setPeriodForm({ label: "", startTime: "09:00", endTime: "09:45", order: String(periods.length + 2) });
      setShowPeriod(false);
      toast.success("Period added");
      await load();
    } catch (error) {
      toast.error("Failed to add period", error instanceof AdminApiError ? error.message : undefined);
    }
  }

  async function remove(kind: "subjects" | "periods", id: string, label: string) {
    const ok = await toast.confirm(`Delete ${label}?`, "This cannot be undone.", { okLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await adminApiRequest(`/api/admin/${kind}/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      await load();
    } catch (error) {
      toast.error("Failed to delete", error instanceof AdminApiError ? error.message : undefined);
    }
  }

  if (!hasPermission(role, "academics.view")) {
    return (
      <section className="p-7">
        <div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div>
      </section>
    );
  }

  return (
    <>
      <PageHeader title="Academics" description="Subject master and daily period structure used by timetables and exams." />
      <section className="space-y-5 p-4 md:p-7">
        <div className="flex flex-wrap gap-2">
          {canCreate && (
            <>
              <button className="btn-primary" onClick={() => setShowSubject((v) => !v)}>
                {showSubject ? <X size={16} /> : <Plus size={16} />} Add subject
              </button>
              <button className="btn-secondary" onClick={() => setShowPeriod((v) => !v)}>
                {showPeriod ? <X size={16} /> : <Plus size={16} />} Add period
              </button>
            </>
          )}
        </div>

        {showSubject && (
          <form onSubmit={addSubject} className="card grid gap-2 p-5 sm:grid-cols-4">
            <input
              className="field"
              placeholder="Subject name"
              required
              value={subjectForm.name}
              onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
            />
            <input
              className="field"
              placeholder="Code (optional)"
              value={subjectForm.code}
              onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
            />
            <select
              className="field"
              value={subjectForm.className}
              onChange={(e) => setSubjectForm({ ...subjectForm, className: e.target.value })}
            >
              <option value="">All classes</option>
              {CLASS_SELECTOR_CLASSES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <button className="btn-primary">Add subject</button>
          </form>
        )}

        {showPeriod && (
          <form onSubmit={addPeriod} className="card grid gap-2 p-5 sm:grid-cols-5">
            <input
              className="field"
              placeholder="Label (e.g. Period 1)"
              required
              value={periodForm.label}
              onChange={(e) => setPeriodForm({ ...periodForm, label: e.target.value })}
            />
            <input
              className="field"
              type="time"
              required
              value={periodForm.startTime}
              onChange={(e) => setPeriodForm({ ...periodForm, startTime: e.target.value })}
            />
            <input
              className="field"
              type="time"
              required
              value={periodForm.endTime}
              onChange={(e) => setPeriodForm({ ...periodForm, endTime: e.target.value })}
            />
            <input
              className="field"
              type="number"
              min="0"
              max="100"
              required
              value={periodForm.order}
              onChange={(e) => setPeriodForm({ ...periodForm, order: e.target.value })}
            />
            <button className="btn-primary">Add period</button>
          </form>
        )}

        <div className="grid gap-5 xl:grid-cols-2">
          <article className="card overflow-x-auto">
            <div className="px-4 py-3">
              <h2 className="font-bold text-[#1f2136]">Subjects</h2>
              <p className="text-xs text-stone-400">{subjects.length} configured</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Class</th>
                  {canEdit && <th className="px-4 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 4 : 3} className="px-4 py-8 text-center text-stone-400">No subjects yet</td>
                  </tr>
                ) : (
                  subjects.map((subject) => (
                    <tr key={subject.id} className="border-t border-stone-100">
                      <td className="px-4 py-2 font-semibold">{subject.name}</td>
                      <td className="px-4 py-2 text-stone-500">{subject.code || "—"}</td>
                      <td className="px-4 py-2 text-stone-500">
                        {subject.className ? CLASS_LABELS[subject.className] ?? subject.className : "All"}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2 text-right">
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-[#ffebed] px-2 py-1 text-xs font-bold text-[#ed515d]"
                            onClick={() => void remove("subjects", subject.id, subject.name)}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>

          <article className="card overflow-x-auto">
            <div className="px-4 py-3">
              <h2 className="font-bold text-[#1f2136]">Periods</h2>
              <p className="text-xs text-stone-400">{periods.length} configured</p>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Label</th>
                  <th className="px-4 py-2">Start</th>
                  <th className="px-4 py-2">End</th>
                  {canEdit && <th className="px-4 py-2 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {periods.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 5 : 4} className="px-4 py-8 text-center text-stone-400">No periods yet</td>
                  </tr>
                ) : (
                  periods.map((period) => (
                    <tr key={period.id} className="border-t border-stone-100">
                      <td className="px-4 py-2 text-stone-400">{period.order}</td>
                      <td className="px-4 py-2 font-semibold">{period.label}</td>
                      <td className="px-4 py-2 text-stone-500">{period.startTime}</td>
                      <td className="px-4 py-2 text-stone-500">{period.endTime}</td>
                      {canEdit && (
                        <td className="px-4 py-2 text-right">
                          <button
                            className="inline-flex items-center gap-1 rounded-lg bg-[#ffebed] px-2 py-1 text-xs font-bold text-[#ed515d]"
                            onClick={() => void remove("periods", period.id, period.label)}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </article>
        </div>
      </section>
    </>
  );
}
