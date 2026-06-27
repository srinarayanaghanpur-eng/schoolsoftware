"use client";

import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { PageHeader } from "@/components/PageHeader";
import { TeacherAttendancePanel } from "@/components/TeacherAttendancePanel";
import { auth } from "@sri-narayana/shared/firebase/client";
import { getAttendancePercentage, type AttendanceRecord, type Teacher } from "@sri-narayana/shared";
import { CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not recorded";
}

export default function MyAttendancePage() {
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const month = currentMonth();

  const loadMe = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch("/api/staff/me", { headers: { authorization: `Bearer ${token}` } });
      const result = (await response.json()) as { ok: boolean; teacher?: Teacher; records?: AttendanceRecord[]; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to load your attendance.");
      setTeacher(result.teacher ?? null);
      setRecords(result.records ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMe();
  }, []);

  const monthRecords = useMemo(() => records.filter((record) => record.month === month), [month, records]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = records.find((record) => record.date === todayKey);
  const attendancePct = useMemo(() => getAttendancePercentage(monthRecords), [monthRecords]);

  return (
    <>
      <PageHeader title="My Attendance" description="Mark your daily check-in / check-out and review your history." />

      <section className="space-y-5 p-4 md:p-7">
        {error && (
          <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>
        )}

        {loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading your attendance…</div>
        ) : teacher ? (
          <>
            <TeacherAttendancePanel teacherId={teacher.id} employmentType={teacher.employmentType} />

            <div className="grid gap-4 sm:grid-cols-3">
              <article className="rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">Today's check-in</p>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f8ef] text-[#14a762]"><CheckCircle2 size={20} /></span>
                </div>
                <p className="mt-3 text-[26px] font-extrabold leading-none text-[#1b1d32]">{formatTime(today?.checkInTime)}</p>
                <p className="mt-2 text-sm font-semibold text-[#7d86a8]">Check-out {formatTime(today?.checkOutTime)}</p>
              </article>

              <article className="rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">This month</p>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eeefff] text-[#3033a1]"><CalendarDays size={20} /></span>
                </div>
                <p className="mt-3 text-[26px] font-extrabold leading-none text-[#1b1d32]">{attendancePct}%</p>
                <p className="mt-2 text-sm font-semibold text-[#7d86a8]">{monthRecords.length} days recorded</p>
              </article>

              <article className="rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)]">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#7d86a8]">Status today</p>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff4df] text-[#e29813]"><Clock3 size={20} /></span>
                </div>
                <p className="mt-3 text-[26px] font-extrabold capitalize leading-none text-[#1b1d32]">{(today?.status ?? "not marked").replace("_", " ")}</p>
                <p className="mt-2 text-sm font-semibold text-[#7d86a8]">{teacher.fullName}</p>
              </article>
            </div>

            <AttendanceCalendar records={monthRecords} month={month} />
          </>
        ) : (
          !error && <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">No attendance profile available.</div>
        )}
      </section>
    </>
  );
}
