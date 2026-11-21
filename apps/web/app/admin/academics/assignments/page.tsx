"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS, CLASS_SELECTOR_CLASSES } from "@/lib/studentClasses";
import { useClassSections } from "@/lib/useClassSections";
import { hasPermission } from "@sri-narayana/shared";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type Assignment = {
  id: string;
  kind: "subject" | "elective" | "class_teacher";
  className: string;
  section?: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  periodsPerWeek?: number;
};

type Teacher = { id: string; fullName?: string; subject?: string };
type Subject = { id: string; name: string; className?: string };

const kindLabels: Record<Assignment["kind"], string> = {
  subject: "Subject teacher",
  elective: "Elective teacher",
  class_teacher: "Class teacher"
};

export default function SubjectAssignmentsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const { sectionsFor } = useClassSections();
  const popup = usePopup();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    kind: "subject" as Assignment["kind"],
    className: "",
    section: "",
    subjectName: "",
    teacherId: "",
    periodsPerWeek: "5"
  });

  const canCreate = hasPermission(role, "academics.create");
  const canEdit = hasPermission(role, "academics.edit");

  const load = async () => {
    try {
      const [assignmentData, teacherData, subjectData] = await Promise.all([
        adminApiRequest<{ assignments: Assignment[] }>("/api/admin/subject-assignments"),
        adminApiRequest<{ teachers: Teacher[] }>("/api/admin/teachers?limit=200"),
        adminApiRequest<{ subjects: Subject[] }>("/api/admin/subjects")
      ]);
      setAssignments(assignmentData.assignments ?? []);
      setTeachers(teacherData.teachers ?? []);
      setSubjects(subjectData.subjects ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const teacher = teachers.find((item) => item.id === form.teacherId);
      await adminApiRequest("/api/admin/subject-assignments", {
        method: "POST",
        body: JSON.stringify({
          kind: form.kind,
          className: form.className,
          section: form.section,
          subjectName: form.kind === "class_teacher" ? "" : form.subjectName,
          teacherId: form.teacherId,
          teacherName: teacher?.fullName ?? "",
          periodsPerWeek: Number(form.periodsPerWeek || 0),
          academicYearId: selectedYear?.id ?? ""
        })
      });
      popup.success("Assignment saved");
      setShowForm(false);
      setForm({ ...form, subjectName: "" });
      await load();
    } catch (err) {
      popup.error("Could not save", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (assignment: Assignment) => {
    const confirmed = await popup.confirm(
      "Remove assignment?",
      `${assignment.subjectName || kindLabels[assignment.kind]} · ${CLASS_LABELS[assignment.className] ?? assignment.className}`,
      { okLabel: "Remove", danger: true }
    );
    if (!confirmed) return;
    try {
      await adminApiRequest(`/api/admin/subject-assignments/${assignment.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      popup.error("Could not remove", err instanceof AdminApiError ? err.message : "Please try again.");
    }
  };

  const subjectOptions = subjects.filter((subject) => !subject.className || subject.className === form.className);
  const sectionOptions = form.className ? sectionsFor(form.className) : [];

  return (
    <>
      <PageHeader
        title="Subject & Class Teacher Assignments"
        description="Map subjects, electives and class teachers to classes and sections."
      />

      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{assignments.length} assignment(s)</p>
          {canCreate && (
            <button className="btn-primary inline-flex items-center gap-2" onClick={() => setShowForm((value) => !value)}>
              {showForm ? <X size={16} /> : <Plus size={16} />}
              {showForm ? "Close" : "New assignment"}
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submit} className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-semibold">
              Assignment type
              <select className="field mt-1" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as Assignment["kind"] })}>
                <option value="subject">Subject teacher</option>
                <option value="elective">Elective teacher</option>
                <option value="class_teacher">Class teacher</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Class
              <select
                className="field mt-1"
                required
                value={form.className}
                onChange={(event) => setForm({ ...form, className: event.target.value, section: "" })}
              >
                <option value="">Select class</option>
                {CLASS_SELECTOR_CLASSES.map((classItem) => (
                  <option key={classItem.id} value={classItem.id}>{classItem.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Section
              <select className="field mt-1" value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })}>
                <option value="">All sections</option>
                {sectionOptions.map((section) => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </label>
            {form.kind !== "class_teacher" && (
              <label className="text-sm font-semibold">
                Subject
                <input
                  className="field mt-1"
                  required
                  list="assignment-subjects"
                  value={form.subjectName}
                  onChange={(event) => setForm({ ...form, subjectName: event.target.value })}
                  placeholder="Mathematics"
                />
                <datalist id="assignment-subjects">
                  {subjectOptions.map((subject) => (
                    <option key={subject.id} value={subject.name} />
                  ))}
                </datalist>
              </label>
            )}
            <label className="text-sm font-semibold">
              Teacher
              <select className="field mt-1" required value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}>
                <option value="">Select teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.fullName}{teacher.subject ? ` · ${teacher.subject}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {form.kind !== "class_teacher" && (
              <label className="text-sm font-semibold">
                Periods / week
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  max={40}
                  value={form.periodsPerWeek}
                  onChange={(event) => setForm({ ...form, periodsPerWeek: event.target.value })}
                />
              </label>
            )}
            <div className="flex justify-end gap-3 sm:col-span-2 lg:col-span-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save assignment"}</button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted-foreground">No assignments yet.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Periods</th>
                  {canEdit && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody>
                {assignments.map((assignment) => (
                  <tr key={assignment.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">{kindLabels[assignment.kind]}</td>
                    <td className="px-4 py-3 font-semibold">{assignment.subjectName || "—"}</td>
                    <td className="px-4 py-3">
                      {CLASS_LABELS[assignment.className] ?? assignment.className}
                      {assignment.section ? ` - ${assignment.section}` : ""}
                    </td>
                    <td className="px-4 py-3">{assignment.teacherName || assignment.teacherId || "—"}</td>
                    <td className="px-4 py-3">{assignment.periodsPerWeek || "—"}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                          onClick={() => void remove(assignment)}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
