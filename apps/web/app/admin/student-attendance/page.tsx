"use client";

import { DatePicker } from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { useClassSections } from "@/lib/useClassSections";
import { CLASS_SELECTOR_CLASSES, CLASS_LABELS } from "@/lib/studentClasses";
import {
  STUDENT_ATTENDANCE_LABELS,
  type StudentAttendanceStatus,
  type StudentAttendanceSummary
} from "@/lib/studentAttendance";
import { hasPermission } from "@sri-narayana/shared";
import { CheckCheck, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Row = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  status: string;
  remark: string;
  markedBy: string;
  updatedAt: string;
};

type ApiResponse = {
  ok: boolean;
  date: string;
  class: string;
  section: string;
  truncated: boolean;
  summary: StudentAttendanceSummary;
  students: Row[];
};

const QUICK_STATUSES: StudentAttendanceStatus[] = ["present", "absent", "late", "half_day", "leave"];

const STATUS_STYLES: Record<string, string> = {
  present: "bg-[#e6f8ef] text-[#14a762] border-[#b9ecd1]",
  absent: "bg-[#ffebed] text-[#ed515d] border-[#ffc9cf]",
  late: "bg-[#fff4df] text-[#b8791a] border-[#ffe1a8]",
  half_day: "bg-[#eef3ff] text-[#3d64c4] border-[#cddafc]",
  leave: "bg-stone-100 text-stone-600 border-stone-200",
  holiday: "bg-violet-50 text-violet-700 border-violet-200"
};

function todayKey() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function StudentAttendancePage() {
  const { role } = useAdminSession();
  const toast = usePopup();
  const { selectedYear } = useAcademicYears();
  const { sectionsFor } = useClassSections();

  const canView = hasPermission(role, "students.view");
  const canEdit = hasPermission(role, "students.edit");

  const [date, setDate] = useState(todayKey());
  const [classId, setClassId] = useState("1");
  const [section, setSection] = useState("A");
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<StudentAttendanceSummary | null>(null);
  const [dirty, setDirty] = useState<Record<string, { status: string; remark: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const sections = useMemo(() => sectionsFor(classId), [sectionsFor, classId]);

  useEffect(() => {
    if (!sections.includes(section)) setSection(sections[0] ?? "A");
  }, [sections, section]);

  async function load() {
    if (!selectedYear?.id || !canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date,
        class: classId,
        section,
        academicYearId: selectedYear.id
      });
      const data = await adminApiRequest<ApiResponse>(`/api/admin/student-attendance?${params.toString()}`);
      setRows(data.students);
      setSummary(data.summary);
      setDirty({});
      if (data.truncated) toast.error("Showing first 400 students", "Split the class or raise the limit.");
    } catch (error) {
      setRows([]);
      setSummary(null);
      toast.error("Failed to load attendance", error instanceof AdminApiError ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, classId, section, selectedYear?.id]);

  function setStatus(studentId: string, status: string) {
    if (!canEdit) return;
    setRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, status } : row)));
    setDirty((current) => ({
      ...current,
      [studentId]: { status, remark: current[studentId]?.remark ?? rows.find((r) => r.studentId === studentId)?.remark ?? "" }
    }));
  }

  function setRemark(studentId: string, remark: string) {
    if (!canEdit) return;
    setRows((current) => current.map((row) => (row.studentId === studentId ? { ...row, remark } : row)));
    setDirty((current) => {
      if (!current[studentId]) return current;
      return { ...current, [studentId]: { ...current[studentId], remark } };
    });
  }

  function markAllPresent() {
    if (!canEdit || rows.length === 0) return;
    const next: Record<string, { status: string; remark: string }> = {};
    for (const row of rows) next[row.studentId] = { status: "present", remark: row.remark };
    setRows((current) => current.map((row) => ({ ...row, status: "present" })));
    setDirty(next);
  }

  async function save() {
    if (!canEdit || !selectedYear?.id) return;
    const records = Object.entries(dirty).map(([studentId, value]) => ({
      studentId,
      status: value.status as StudentAttendanceStatus,
      remark: value.remark
    }));
    if (records.length === 0) {
      toast.success("Nothing to save", "Mark at least one student first.");
      return;
    }
    setSaving(true);
    try {
      const result = await adminApiRequest<{ ok: boolean; written: number; skipped: number }>(
        "/api/admin/student-attendance",
        {
          method: "POST",
          body: JSON.stringify({
            date,
            class: classId,
            section,
            academicYearId: selectedYear.id,
            records
          })
        }
      );
      setDirty({});
      toast.success("Attendance saved", `${result.written} record${result.written === 1 ? "" : "s"} written.`);
      await load();
    } catch (error) {
      toast.error("Failed to save attendance", error instanceof AdminApiError ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return (
      <section className="p-7">
        <div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div>
      </section>
    );
  }

  const dirtyCount = Object.keys(dirty).length;
  const displaySummary = summary ?? null;

  return (
    <>
      <PageHeader
        title="Student Attendance"
        description="Mark daily attendance by class and section. Only changed rows are written."
      />
      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && (
          <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load the roster.</div>
        )}

        <div className="card grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold text-[#303247]">
            Date
            <DatePicker value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full" />
          </label>
          <label className="text-sm font-semibold text-[#303247]">
            Class
            <select className="field mt-1" value={classId} onChange={(event) => setClassId(event.target.value)}>
              {CLASS_SELECTOR_CLASSES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#303247]">
            Section
            <select className="field mt-1" value={section} onChange={(event) => setSection(event.target.value)}>
              {sections.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button className="btn-secondary w-full" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : undefined} /> Refresh
            </button>
          </div>
        </div>

        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Chip label="Present" value={displaySummary?.present ?? 0} tone="present" />
            <Chip label="Absent" value={displaySummary?.absent ?? 0} tone="absent" />
            <Chip label="Late" value={displaySummary?.late ?? 0} tone="late" />
            <Chip label="Half day" value={displaySummary?.half_day ?? 0} tone="half_day" />
            <Chip label="Leave" value={displaySummary?.leave ?? 0} tone="leave" />
            <Chip label="Unmarked" value={displaySummary?.unmarked ?? rows.length} tone="muted" />
            <span className="ml-1 text-stone-400">{CLASS_LABELS[classId] ?? classId} {section} · {rows.length} students</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={markAllPresent} disabled={!canEdit || rows.length === 0}>
              <CheckCheck size={16} /> Mark all present
            </button>
            <button className="btn-primary" onClick={() => void save()} disabled={!canEdit || saving || dirtyCount === 0}>
              <Save size={16} /> {saving ? "Saving..." : `Save${dirtyCount ? ` (${dirtyCount})` : ""}`}
            </button>
          </div>
        </div>

        <article className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Student</th>
                <th className="px-4 py-2">Admission</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Remark</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-stone-400">Loading roster...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-stone-400">
                    No students found for {CLASS_LABELS[classId] ?? classId} {section}.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const current = dirty[row.studentId]?.status ?? row.status;
                  return (
                    <tr key={row.studentId} className="border-t border-stone-100 align-top">
                      <td className="px-4 py-2 text-stone-400">{index + 1}</td>
                      <td className="px-4 py-2">
                        <div className="font-semibold text-[#1f2136]">{row.studentName || "Unnamed student"}</div>
                        <div className="text-xs text-stone-400">Roll {row.rollNumber || "—"}</div>
                      </td>
                      <td className="px-4 py-2 text-stone-500">{row.admissionNumber || "—"}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {QUICK_STATUSES.map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setStatus(row.studentId, status)}
                              disabled={!canEdit}
                              aria-pressed={current === status}
                              className={`rounded-lg border px-2 py-1 text-xs font-bold transition ${
                                current === status
                                  ? STATUS_STYLES[status]
                                  : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 disabled:opacity-50"
                              }`}
                              title={STUDENT_ATTENDANCE_LABELS[status]}
                            >
                              {shortLabel(status)}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="field w-44"
                          placeholder="Optional"
                          value={dirty[row.studentId]?.remark ?? row.remark}
                          onChange={(event) => setRemark(row.studentId, event.target.value)}
                          disabled={!canEdit || !dirty[row.studentId]}
                          title={dirty[row.studentId] ? undefined : "Mark attendance first to add a remark"}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </article>

        <p className="text-xs text-stone-400">
          Quota note: loading this page costs about {rows.length + (displaySummary?.marked ?? 0)} reads; saving writes only the
          rows you changed (1 write each). Marking one 40-student class creates 40 writes.
        </p>
      </section>
    </>
  );
}

function shortLabel(status: StudentAttendanceStatus) {
  switch (status) {
    case "present":
      return "P";
    case "absent":
      return "A";
    case "late":
      return "L";
    case "half_day":
      return "HD";
    case "leave":
      return "Lv";
    default:
      return status;
  }
}

function Chip({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneClass =
    tone === "muted"
      ? "bg-stone-100 text-stone-600"
      : STATUS_STYLES[tone] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${toneClass}`}>
      <span>{label}</span>
      <span>{value}</span>
    </span>
  );
}
