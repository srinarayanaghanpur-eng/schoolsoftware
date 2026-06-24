"use client";

import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { PageHeader } from "@/components/PageHeader";
import { auth } from "@sri-narayana/shared/firebase/client";
import type { AttendanceRecord, Teacher } from "@sri-narayana/shared";
import { useEffect, useMemo, useState } from "react";

type AttendancePayload = {
  records: AttendanceRecord[];
  teachers: Teacher[];
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function CalendarPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedRecords = useMemo(
    () => records.filter((record) => record.teacherId === selectedTeacherId && record.month === month),
    [month, records, selectedTeacherId]
  );

  useEffect(() => {
    const loadCalendarData = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please sign in as admin again.");
        const response = await fetch("/api/admin/attendance", {
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
  }, []);

  return (
    <>
      <PageHeader title="Calendar View" description="Color-coded monthly attendance with daily details." />
      <section className="space-y-4 p-4 md:p-6">
        {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
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
          <input className="field max-w-xs" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </div>
        {loading ? (
          <div className="card p-6 text-sm text-stone-500">Loading real teacher calendar...</div>
        ) : (
          <AttendanceCalendar records={selectedRecords} month={month} />
        )}
      </section>
    </>
  );
}
