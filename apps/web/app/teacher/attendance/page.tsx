"use client";

import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { CLASS_LABELS, CLASS_SELECTOR_CLASSES } from "@/lib/studentClasses";
import { useClassSections } from "@/lib/useClassSections";
import {
  STUDENT_ATTENDANCE_LABELS,
  type StudentAttendanceStatus
} from "@/lib/studentAttendance";
import { CalendarDays, CheckCircle2, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RosterRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: string;
  status: StudentAttendanceStatus | "";
};

const MARKABLE: StudentAttendanceStatus[] = ["present", "absent", "late", "leave"];

const statusStyles: Record<string, string> = {
  present: "bg-[#e6f8ef] text-[#14a762] ring-[#14a762]",
  absent: "bg-[#ffeaec] text-[#dd5369] ring-[#dd5369]",
  late: "bg-[#fff6e5] text-[#c47f00] ring-[#c47f00]",
  leave: "bg-[#eeefff] text-[#3033a1] ring-[#3033a1]",
  half_day: "bg-[#f3f4fb] text-[#6f7899] ring-[#6f7899]",
  holiday: "bg-[#f3f4fb] text-[#6f7899] ring-[#6f7899]"
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function TeacherAttendancePage() {
  const { sectionsFor } = useClassSections();
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sectionOptions = useMemo(() => (className ? sectionsFor(className) : []), [className, sectionsFor]);

  useEffect(() => {
    if (!className) return;
    const sections = sectionsFor(className);
    if (sections.length > 0 && !sections.includes(section)) {
      setSection(sections[0]);
    }
  }, [className, section, sectionsFor]);

  useEffect(() => {
    if (!className || !section) return;
    let active = true;
    setLoading(true);
    setNotice("");
    void adminApiRequest<{ students: RosterRow[] }>(
      `/api/admin/student-attendance?date=${date}&class=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`,
      undefined,
      { fresh: true }
    )
      .then((data) => {
        if (!active) return;
        setStudents(data.students ?? []);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof AdminApiError ? err.message : "Unable to load roster");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [className, section, date]);

  const setStatus = (studentId: string, status: StudentAttendanceStatus) => {
    setStudents((current) =>
      current.map((student) =>
        student.studentId === studentId
          ? { ...student, status: student.status === status ? "" : status }
          : student
      )
    );
  };

  const markAll = (status: StudentAttendanceStatus) => {
    setStudents((current) => current.map((student) => ({ ...student, status })));
  };

  const save = async () => {
    if (saving || !className || !section) return;
    const records = students
      .filter((student) => student.status)
      .map((student) => ({ studentId: student.studentId, status: student.status as StudentAttendanceStatus }));
    if (records.length === 0) {
      setNotice("Mark at least one student first.");
      return;
    }
    setSaving(true);
    try {
      await adminApiRequest("/api/admin/student-attendance", {
        method: "POST",
        body: JSON.stringify({ date, class: className, section, records })
      });
      setNotice(`Saved ${records.length} record(s) for ${CLASS_LABELS[className] ?? className} - ${section}.`);
      setError("");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to save attendance");
    } finally {
      setSaving(false);
    }
  };

  const marked = students.filter((student) => student.status);
  const present = marked.filter((student) => student.status === "present").length;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f8f9fd] px-4 py-6 md:px-8">
      <header className="mb-5">
        <p className="text-xs font-bold uppercase tracking-widest text-[#6f7899]">Daily Ops</p>
        <h1 className="text-2xl font-black tracking-tight text-[#151a3c]">Mark Student Attendance</h1>
        <p className="mt-1 text-sm font-medium text-[#6f7899]">
          Pick a class, tap each student and save. Only changed students are written.
        </p>
      </header>

      {error && <div className="mb-4 rounded-2xl bg-[#ffeaec] px-4 py-3 text-sm font-bold text-[#dd5369]">{error}</div>}
      {notice && <div className="mb-4 rounded-2xl bg-[#e6f8ef] px-4 py-3 text-sm font-bold text-[#14a762]">{notice}</div>}

      <section className="mb-4 grid gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#e6e8f2] sm:grid-cols-3">
        <label className="text-sm font-bold text-[#151a3c]">
          Class
          <select className="mt-1 w-full rounded-xl border border-[#e6e8f2] bg-white px-3 py-2.5 text-sm font-semibold" value={className} onChange={(event) => setClassName(event.target.value)}>
            <option value="">Select class</option>
            {CLASS_SELECTOR_CLASSES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-[#151a3c]">
          Section
          <select className="mt-1 w-full rounded-xl border border-[#e6e8f2] bg-white px-3 py-2.5 text-sm font-semibold" value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="">Select section</option>
            {sectionOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-bold text-[#151a3c]">
          Date
          <div className="relative mt-1">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa2bd]" size={16} />
            <input type="date" className="w-full rounded-xl border border-[#e6e8f2] bg-white py-2.5 pl-9 pr-3 text-sm font-semibold" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
        </label>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-[#e6e8f2]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-[#151a3c]">
            {students.length} student(s) · {marked.length} marked · {present} present
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-xl bg-[#e6f8ef] px-3 py-2 text-xs font-bold text-[#14a762]" onClick={() => markAll("present")}>
              All present
            </button>
            <button type="button" className="rounded-xl bg-[#ffeaec] px-3 py-2 text-xs font-bold text-[#dd5369]" onClick={() => markAll("absent")}>
              All absent
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#3033a1] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              disabled={saving || marked.length === 0}
              onClick={() => void save()}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save attendance
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-[#3033a1]" /></div>
        ) : !className || !section ? (
          <p className="p-8 text-center text-sm font-semibold text-[#6f7899]">Select a class and section to load the roster.</p>
        ) : students.length === 0 ? (
          <p className="p-8 text-center text-sm font-semibold text-[#6f7899]">No active students in this class/section.</p>
        ) : (
          <ul className="divide-y divide-[#eef0f7]">
            {students.map((student) => (
              <li key={student.studentId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#151a3c]">{student.studentName}</p>
                  <p className="text-xs font-semibold text-[#9aa2bd]">
                    {student.admissionNumber}{student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MARKABLE.map((status) => {
                    const active = student.status === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatus(student.studentId, status)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${active ? statusStyles[status] : "bg-white text-[#6f7899] ring-[#e6e8f2] hover:bg-[#f3f4fb]"}`}
                      >
                        {active && <CheckCircle2 size={12} />}
                        {STUDENT_ATTENDANCE_LABELS[status]}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
