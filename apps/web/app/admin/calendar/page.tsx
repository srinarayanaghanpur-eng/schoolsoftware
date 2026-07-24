"use client";

import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { DatePicker } from "@/components/DatePicker";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { PageHeader } from "@/components/PageHeader";
import { auth } from "@sri-narayana/shared/firebase/client";
import type { AttendanceRecord, Teacher } from "@sri-narayana/shared";
import { useEffect, useMemo, useState } from "react";

type AttendancePayload = {
  records: AttendanceRecord[];
  teachers: Teacher[];
};

export default function CalendarPage() {
  const { selectedYear } = useAcademicYears();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedRecords = useMemo(
    () => records.filter((record) => record.teacherId === selectedTeacherId && record.month === month),
    [month, records, selectedTeacherId]
  );

  useEffect(() => {
    const loadCalendarData = async () => {
      if (!selectedYear?.id) {
        setTeachers([]);
        setRecords([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please sign in as admin again.");
        const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "25" });
        const response = await fetch(`/api/admin/attendance?${params}`, {
          headers: { authorization: `Bearer ${token}` }
        });
        const result = (await response.json()) as AttendancePayload & { ok?: boolean; error?: string };
        if (!response.ok || result.ok === false) throw new Error(result.error ?? "Unable to load calendar");
        setTeachers(result.teachers);
        setRecords(result.records);
        setSelectedTeacherId((current) => current || result.teachers[0]?.id || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load calendar");
      } finally {
        setLoading(false);
      }
    };

    void loadCalendarData();
  }, [selectedYear?.id]);

  return (
    <>
      <PageHeader title="Calendar View" description="Color-coded monthly attendance with daily details." />
      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load the calendar.</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        <div className="card flex flex-col gap-3 p-4 md:flex-row">
          <select
            className="field max-w-sm"
            value={selectedTeacherId}
            onChange={(event) => setSelectedTeacherId(event.target.value)}
            disabled={loading || teachers.length === 0}
          >
            {teachers.length === 0 ? (
              <option value="">No teachers found</option>
            ) : (
              teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName} ({teacher.employeeId})
                </option>
              ))
            )}
          </select>
          <div className="w-full max-w-xs"><DatePicker type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></div>
        </div>
        {loading ? (
          <div className="card p-6 text-sm font-medium text-[#7d86a8]">Loading real teacher calendar...</div>
        ) : (
          <AttendanceCalendar records={selectedRecords} month={month} />
        )}
      </section>
    </>
  );
}
