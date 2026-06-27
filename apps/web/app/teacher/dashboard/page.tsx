"use client";

import { AttendanceCalendar } from "@/components/AttendanceCalendar";
import { LazyTeacherPieChart } from "@/components/LazyDashboardCharts";
import { StatusBadge } from "@/components/StatusBadge";
import { TeacherAttendancePanel } from "@/components/TeacherAttendancePanel";
import { BrandLoader } from "@/components/BrandLoader";
import { auth } from "@sri-narayana/shared/firebase/client";
import { getAttendancePercentage, type AttendanceRecord, type Teacher } from "@sri-narayana/shared";
import { signOut } from "firebase/auth";
import { CalendarDays, CheckCircle2, Clock3, LogOut, MapPin, Sparkles, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type TeacherDashboardPayload = {
  teacher: Teacher;
  records: AttendanceRecord[];
};

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not recorded";
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function TeacherMetric({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  delay
}: {
  label: string;
  value: string | React.ReactNode;
  helper: string;
  icon: typeof CalendarDays;
  tone: string;
  delay: number;
}) {
  return (
    <article
      className="dashboard-animate rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(36,42,94,0.09)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#7d86a8]">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} strokeWidth={2.25} /></span>
      </div>
      <div className="mt-3 min-h-8 text-[28px] font-extrabold leading-none tracking-tight text-[#1b1d32]">{value}</div>
      <p className="mt-2 text-sm font-semibold text-[#7d86a8]">{helper}</p>
    </article>
  );
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const month = currentMonth();

  const monthRecords = useMemo(() => records.filter((record) => record.month === month), [month, records]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = records.find((record) => record.date === todayKey);
  const percentage = getAttendancePercentage(monthRecords);
  const presentCount = monthRecords.filter((record) => record.status === "present").length;
  const lateCount = monthRecords.filter((record) => record.status === "late").length;
  const absentCount = monthRecords.filter((record) => record.status === "absent").length;
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${month}-01T00:00:00`));

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please sign in again.");
        const response = await fetch("/api/teacher/me", {
          headers: { authorization: `Bearer ${token}` }
        });
        const result = (await response.json()) as TeacherDashboardPayload & { ok?: boolean; error?: string };
        if (!response.ok || result.ok === false) throw new Error(result.error ?? "Unable to load dashboard");
        setTeacher(result.teacher);
        setRecords(result.records);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } finally {
      router.replace("/login");
    }
  };

  if (loading) {
    return <BrandLoader message="Preparing your attendance workspace…" />;
  }

  if (error || !teacher) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6fd] p-4">
        <div className="max-w-md rounded-2xl border border-[#ffd7da] bg-[#fff7f7] p-5 text-sm font-medium text-[#bf3345] shadow-sm">
          {error ?? "Teacher profile is missing. Please contact the administrator."}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f6fd] text-[#1b1d32]">
      <header className="border-b border-[#e4e6f0] bg-white/95 px-4 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {teacher.profilePhotoUrl ? (
              <img src={teacher.profilePhotoUrl} alt="" className="h-11 w-11 rounded-xl object-cover shadow-sm" />
            ) : (
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#eeefff] text-sm font-extrabold text-[#3033a1]">{initials(teacher.fullName)}</span>
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.12em] text-[#777fc4]">TEACHER PORTAL</p>
              <h1 className="truncate text-lg font-extrabold tracking-tight text-[#17192e] sm:text-xl">{greeting()}, {teacher.fullName.split(" ")[0]}</h1>
              <p className="truncate text-xs font-medium text-[#7d86a8]">{teacher.subject} · {teacher.employeeId}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-3 py-2.5 text-sm font-bold text-[#353864] transition hover:border-[#c8ccef] hover:bg-[#f0f1fb] disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleLogout}
            disabled={signingOut}
          >
            <LogOut size={17} />
            <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] space-y-5 p-4 md:p-7">
        <article className="dashboard-animate relative overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_90%_15%,#5a5ec9_0%,#30328f_42%,#24266f_100%)] px-5 py-6 text-white shadow-[0_16px_32px_rgba(36,38,111,0.22)] md:px-7" style={{ animationDelay: "30ms" }}>
          <div className="absolute -right-8 -top-12 h-44 w-44 rounded-full border border-white/10" />
          <div className="absolute right-20 top-12 h-16 w-16 rounded-full bg-[#f7c548]/15 blur-xl" />
          <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#d7dcff]"><Sparkles size={16} className="text-[#ffd35b]" /> Your workday, at a glance</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">Ready when you are.</h2>
              <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#d7dcff]">Use the secure attendance action below to record your check-in or check-out from campus.</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f7c548] text-[#282a79]"><CalendarDays size={20} /></span>
              <span><span className="block text-xs font-semibold text-[#d7dcff]">Today</span><span className="block text-sm font-extrabold">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></span>
            </div>
          </div>
        </article>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TeacherMetric label="Today’s status" value={<StatusBadge status={today?.status ?? "not_marked"} />} helper={today ? "Attendance is up to date" : "No activity recorded yet"} icon={CheckCircle2} tone="bg-[#e6f8ef] text-[#14a762]" delay={70} />
          <TeacherMetric label="Last check-in" value={today?.checkInTime ? formatTime(today.checkInTime) : "—"} helper={today?.checkInTime ? "Recorded today" : "Awaiting your check-in"} icon={Clock3} tone="bg-[#eeefff] text-[#3033a1]" delay={110} />
          <TeacherMetric label="Monthly attendance" value={`${percentage}%`} helper={`${presentCount} present day${presentCount === 1 ? "" : "s"} in ${monthLabel}`} icon={CalendarDays} tone="bg-[#fff4df] text-[#e29813]" delay={150} />
          <TeacherMetric label="Campus verification" value={today?.distanceFromCampus !== undefined ? `${today.distanceFromCampus} m` : "Ready"} helper={today?.distanceFromCampus !== undefined ? "From the school campus" : "GPS location required"} icon={MapPin} tone="bg-[#ffeaec] text-[#dd5369]" delay={190} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <TeacherAttendancePanel teacherId={teacher.id} employmentType={teacher.employmentType} />

          <article className="dashboard-animate rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)]" style={{ animationDelay: "260ms" }}>
            <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-[#242640]">Monthly overview</p><p className="mt-1 text-xs font-medium text-[#7d86a8]">{monthLabel}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef0ff] text-[#3436a2]"><UserRound size={18} /></span></div>
            <div className="mt-4 grid place-items-center"><LazyTeacherPieChart present={presentCount} late={lateCount} absent={absentCount} /></div>
            <div className="mt-4 grid grid-cols-3 divide-x divide-[#edf0f7] text-center">
              <p><span className="block text-lg font-extrabold text-[#1d1f35]">{presentCount}</span><span className="text-xs font-semibold text-[#7d86a8]">Present</span></p>
              <p><span className="block text-lg font-extrabold text-[#e39b1b]">{lateCount}</span><span className="text-xs font-semibold text-[#7d86a8]">Late</span></p>
              <p><span className="block text-lg font-extrabold text-[#dd5369]">{absentCount}</span><span className="text-xs font-semibold text-[#7d86a8]">Absent</span></p>
            </div>
          </article>
        </div>

        <article className="dashboard-animate overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white shadow-[0_2px_4px_rgba(36,42,94,0.03)]" style={{ animationDelay: "320ms" }}>
          <div className="flex flex-col gap-1 border-b border-[#edf0f7] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold text-[#23253a]">Attendance calendar</h2><p className="mt-0.5 text-sm font-medium text-[#7d86a8]">A daily view of your {monthLabel} record</p></div><span className="mt-2 inline-flex w-fit items-center rounded-lg bg-[#f1f2fa] px-3 py-1.5 text-xs font-bold text-[#4d5096] sm:mt-0">{monthRecords.length} recorded days</span></div>
          <AttendanceCalendar records={monthRecords} month={month} />
        </article>
      </section>
    </main>
  );
}
