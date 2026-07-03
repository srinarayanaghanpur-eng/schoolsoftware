import Link from "next/link";
import type { ReactNode } from "react";
import {
  BellRing,
  BookOpenCheck,
  Bus,
  CalendarDays,
  Circle,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  GraduationCap,
  Hotel,
  IndianRupee,
  Library,
  Megaphone,
  MoreHorizontal,
  Package,
  Send,
  Settings,
  ShieldCheck,
  UserCog,
  UserPlus,
  UsersRound,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { logFirestoreAggregateRead, logFirestoreRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const quickActions = [
  { href: "/admin/students", label: "Add Student", icon: UserPlus, tone: "bg-[#edf1ff] text-[#2e38a4]" },
  { href: "/admin/attendance", label: "Mark Attendance", icon: ClipboardCheck, tone: "bg-[#fff4df] text-[#c67711]" },
  { href: "/admin/payments", label: "Collect Fee", icon: CreditCard, tone: "bg-[#e9f8f0] text-[#0d8f5b]" },
  { href: "/admin/teachers", label: "Add Staff", icon: GraduationCap, tone: "bg-[#eef6ff] text-[#1967b2]" },
  { href: "/admin/notifications", label: "New Notice", icon: Megaphone, tone: "bg-[#fff0f2] text-[#d1485c]" },
  { href: "/admin/exams", label: "Create Exam", icon: BookOpenCheck, tone: "bg-[#f4efff] text-[#7445bd]" },
  { href: "/admin/reports", label: "Generate Report", icon: FileSpreadsheet, tone: "bg-[#eef7f8] text-[#17808a]" },
  { href: "/admin/settings", label: "View All", icon: MoreHorizontal, tone: "bg-[#f2f4fa] text-[#5a6383]" }
];

const moduleShortcuts = [
  { href: "/admin/parents", label: "Parents", icon: UsersRound, tone: "bg-[#edf1ff] text-[#2e38a4]" },
  { href: "/admin/exams", label: "Exams & Marks", icon: BookOpenCheck, tone: "bg-[#f4efff] text-[#7445bd]" },
  { href: "/admin/notices", label: "Communication", icon: Megaphone, tone: "bg-[#fff4df] text-[#c67711]" },
  { href: "/admin/messages", label: "Messages", icon: Send, tone: "bg-[#eef6ff] text-[#1967b2]" },
  { href: "/admin/academic-years", label: "Academic Years", icon: CalendarDays, tone: "bg-[#f0f7ef] text-[#3d8b4d]" },
  { href: "/admin/promotions", label: "Promotion", icon: GraduationCap, tone: "bg-[#f4efff] text-[#7445bd]" },
  { href: "/admin/users", label: "Users & Roles", icon: UserCog, tone: "bg-[#edf1ff] text-[#2e38a4]" },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, tone: "bg-[#eef7f8] text-[#17808a]" },
  { href: "/admin/calendar", label: "Timetable", icon: CalendarDays, tone: "bg-[#fff4df] text-[#c67711]" },
  { href: "/admin/transport", label: "Transport", icon: Bus, tone: "bg-[#eef6ff] text-[#1967b2]" },
  { href: "/admin/library", label: "Library", icon: Library, tone: "bg-[#f0f7ef] text-[#3d8b4d]" },
  { href: "/admin/hostel", label: "Hostel", icon: Hotel, tone: "bg-[#fff0f2] text-[#d1485c]" },
  { href: "/admin/inventory", label: "Inventory", icon: Package, tone: "bg-[#f4efff] text-[#7445bd]" }
];

function istDateKey(date: Date) {
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

function formatINR(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

type DashboardData = {
  totalStudents: number;
  totalTeachers: number;
  presentToday: number;
  feesCollected: number;
  feesCollectedToday: number;
  feesOutstanding: number;
  totalFeeAmount: number;
  studentsPending: number;
  weekAttendance: { day: string; value: number }[];
  recentStudents: { name: string; cls: string; initials: string }[];
  notices: { title: string; meta: string }[];
};

async function loadDashboard(): Promise<DashboardData> {
  const db = adminDb();
  const now = new Date();
  const today = istDateKey(now);
  const weekAgo = istDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const studentsCountQuery = db.collection("students").count();
  const activeTeachersCountQuery = db.collection("teachers").where("status", "==", "active").count();
  const feeTotalsQuery = db.collection("studentFeeSummaries").aggregate({
    totalFeeAmount: AggregateField.sum("totalFee"),
    feesOutstanding: AggregateField.sum("dueAmount")
  });
  const studentsPendingQuery = db.collection("studentFeeSummaries").where("dueAmount", ">", 0).count();
  const feesCollectedQuery = db.collection("financeSummaries").aggregate({
    feesCollected: AggregateField.sum("totalIncome")
  });
  const feesCollectedTodayQuery = db.collection("payments")
    .where("status", "==", "completed")
    .where("createdAt", ">=", startOfToday)
    .where("createdAt", "<=", endOfToday)
    .aggregate({ feesCollectedToday: AggregateField.sum("amountPaid") });

  const [
    studentsCountSnap,
    activeTeachersCountSnap,
    feeTotalsSnap,
    studentsPendingSnap,
    feesCollectedSnap,
    feesCollectedTodaySnap,
    weekAttSnap,
    noticesSnap,
    recentStudentsSnap
  ] = await Promise.all([
    studentsCountQuery.get(),
    activeTeachersCountQuery.get(),
    feeTotalsQuery.get().catch(() => null),
    studentsPendingQuery.get().catch(() => null),
    feesCollectedQuery.get().catch(() => null),
    feesCollectedTodayQuery.get().catch(() => null),
    db.collection("attendance").where("date", ">=", weekAgo).where("date", "<=", today).get(),
    db.collection("notifications").orderBy("createdAt", "desc").limit(3).get().catch(() => null),
    db.collection("students").orderBy("createdAt", "desc").limit(3).get().catch(() => null)
  ]);

  logFirestoreAggregateRead("AdminDashboard", "students", { operation: "count" });
  logFirestoreAggregateRead("AdminDashboard", "teachers", { operation: "active-count" });
  logFirestoreAggregateRead("AdminDashboard", "studentFeeSummaries", { operation: "sum-total-and-due" });
  logFirestoreAggregateRead("AdminDashboard", "financeSummaries", { operation: "sum-income" });
  logFirestoreAggregateRead("AdminDashboard", "payments", { operation: "today-sum" });
  logFirestoreRead("AdminDashboard", "attendance", weekAttSnap, { from: weekAgo, to: today });
  if (noticesSnap) logFirestoreRead("AdminDashboard", "notifications", noticesSnap, { limit: 3 });
  if (recentStudentsSnap) logFirestoreRead("AdminDashboard", "students", recentStudentsSnap, { limit: 3, purpose: "recent" });

  const totalStudents = Number(studentsCountSnap.data().count || 0);
  const totalTeachers = Number(activeTeachersCountSnap.data().count || 0);
  const feeTotals = (feeTotalsSnap?.data() ?? {}) as Record<string, unknown>;
  const totalFeeAmount = Number(feeTotals.totalFeeAmount || 0);
  const feesOutstanding = Number(feeTotals.feesOutstanding || 0);
  const studentsPending = Number(studentsPendingSnap?.data().count || 0);
  const feesCollected = Number(feesCollectedSnap?.data().feesCollected || 0);
  const feesCollectedToday = Number(feesCollectedTodaySnap?.data().feesCollectedToday || 0);

  const present = (status?: string) => status === "present" || status === "late";
  const byDay = new Map<string, { present: number }>();
  let presentToday = 0;

  weekAttSnap.docs.forEach((doc) => {
    const attendance = doc.data();
    if (attendance.date === today && present(attendance.status)) presentToday += 1;
    const entry = byDay.get(attendance.date) ?? { present: 0 };
    if (present(attendance.status)) entry.present += 1;
    byDay.set(attendance.date, entry);
  });

  const weekAttendance = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000);
    const key = istDateKey(date);
    const presentCount = byDay.get(key)?.present ?? 0;
    return {
      day: DAY_LABELS[date.getDay()],
      value: totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 0
    };
  });

  const recentStudents = (recentStudentsSnap?.docs ?? [])
    .map((doc) => doc.data())
    .map((student) => {
      const name = student.studentName || "Unknown";
      return {
        name: `${name}${student.class ? ` · Class ${student.class}${student.section || ""}` : ""}`,
        cls: student.class || "",
        initials: name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase() || "?"
      };
    });

  const notices = (noticesSnap?.docs ?? []).map((doc) => {
    const notice = doc.data();
    return {
      title: notice.title || notice.message || "Notice",
      meta: notice.createdAt ? new Date(notice.createdAt).toLocaleDateString("en-IN") : "Recently"
    };
  });

  return {
    totalStudents,
    totalTeachers,
    presentToday,
    feesCollected,
    feesCollectedToday,
    feesOutstanding,
    totalFeeAmount,
    studentsPending,
    weekAttendance,
    recentStudents,
    notices
  };
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone,
  helperTone = "text-[#5f6b8d]"
}: {
  label: string;
  value: string;
  helper: string;
  icon?: LucideIcon;
  tone: string;
  helperTone?: string;
}) {
  const SafeIcon = Icon ?? Circle;
  return (
    <article className="dashboard-animate rounded-lg border border-[#e1e7f4] bg-white p-4 shadow-[0_10px_26px_rgba(31,42,116,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(31,42,116,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
          <SafeIcon size={20} strokeWidth={2.3} />
        </span>
        <span className="rounded-full bg-[#f4f7ff] px-2 py-1 text-[11px] font-extrabold text-[#5f6b8d]">Live</span>
      </div>
      <p className="mt-4 text-sm font-bold text-[#657092]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#141735] md:text-[28px]">{value}</p>
      <p className={`mt-1 text-xs font-bold ${helperTone}`}>{helper}</p>
    </article>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <article className={`dashboard-animate rounded-lg border border-[#e1e7f4] bg-white shadow-[0_10px_26px_rgba(31,42,116,0.05)] ${className}`}>
      {children}
    </article>
  );
}

function AttendanceTrend({ data }: { data: { day: string; value: number }[] }) {
  const width = 680;
  const height = 230;
  const paddingX = 36;
  const paddingTop = 22;
  const paddingBottom = 36;
  const chartHeight = height - paddingTop - paddingBottom;
  const span = Math.max(1, data.length - 1);
  const points = data.map((item, index) => {
    const x = paddingX + (index / span) * (width - paddingX * 2);
    const y = paddingTop + (1 - clampPercent(item.value) / 100) * chartHeight;
    return { ...item, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${paddingX},${height - paddingBottom} ${line} ${width - paddingX},${height - paddingBottom}`;

  return (
    <svg className="mt-4 h-[230px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Staff attendance trend for the last seven days">
      <defs>
        <linearGradient id="attendanceArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3c46d1" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#3c46d1" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = paddingTop + (1 - tick / 100) * chartHeight;
        return (
          <g key={tick}>
            <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#e7ebf5" strokeWidth="1" />
            <text x={8} y={y + 4} fill="#7d86a8" fontSize="12" fontWeight="700">{tick}%</text>
          </g>
        );
      })}
      <polygon points={area} fill="url(#attendanceArea)" />
      <polyline points={line} fill="none" stroke="#3540c0" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
      {points.map((point) => (
        <g key={`${point.day}-${point.x}`}>
          <circle cx={point.x} cy={point.y} r="5" fill="#3540c0" stroke="#fff" strokeWidth="3" />
          <text x={point.x} y={height - 8} textAnchor="middle" fill="#707a9e" fontSize="13" fontWeight="800">{point.day}</text>
        </g>
      ))}
    </svg>
  );
}

function ActivityItem({
  icon: Icon,
  title,
  meta,
  tone
}: {
  icon?: LucideIcon;
  title: string;
  meta: string;
  tone: string;
}) {
  const SafeIcon = Icon ?? Circle;
  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition hover:bg-[#f8faff]">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone}`}>
        <SafeIcon size={17} strokeWidth={2.25} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold text-[#20233f]">{title}</span>
        <span className="block truncate text-xs font-semibold text-[#7d86a8]">{meta}</span>
      </span>
    </div>
  );
}

function QuickAction({ href, label, icon: Icon, tone }: { href: string; label: string; icon?: LucideIcon; tone: string }) {
  const SafeIcon = Icon ?? Circle;
  return (
    <Link href={href} className="group flex min-w-[92px] flex-col items-center gap-2 rounded-lg px-2 py-2 text-center transition hover:bg-[#f8faff]">
      <span className={`grid h-11 w-11 place-items-center rounded-lg transition group-hover:scale-105 ${tone}`}>
        <SafeIcon size={21} strokeWidth={2.3} />
      </span>
      <span className="text-xs font-extrabold leading-4 text-[#242744]">{label}</span>
    </Link>
  );
}

function ModuleShortcut({ href, label, icon: Icon, tone }: { href: string; label: string; icon?: LucideIcon; tone: string }) {
  const SafeIcon = Icon ?? Circle;
  return (
    <Link href={href} className="dashboard-animate group flex min-h-[96px] flex-col items-center justify-center gap-3 rounded-lg border border-[#e1e7f4] bg-white px-3 py-4 text-center shadow-[0_8px_18px_rgba(31,42,116,0.04)] transition hover:-translate-y-0.5 hover:border-[#c7d1ec] hover:shadow-[0_14px_28px_rgba(31,42,116,0.08)]">
      <span className={`grid h-11 w-11 place-items-center rounded-lg transition group-hover:scale-105 ${tone}`}>
        <SafeIcon size={21} strokeWidth={2.25} />
      </span>
      <span className="text-xs font-extrabold leading-4 text-[#253052]">{label}</span>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const data = await loadDashboard().catch(() => null);

  const d: DashboardData = data ?? {
    totalStudents: 0,
    totalTeachers: 0,
    presentToday: 0,
    feesCollected: 0,
    feesCollectedToday: 0,
    feesOutstanding: 0,
    totalFeeAmount: 0,
    studentsPending: 0,
    weekAttendance: DAY_LABELS.map((day) => ({ day, value: 0 })),
    recentStudents: [],
    notices: []
  };

  const collectedPct = clampPercent(d.totalFeeAmount > 0 ? (d.feesCollected / d.totalFeeAmount) * 100 : 0);
  const attendancePct = clampPercent(d.totalTeachers > 0 ? (d.presentToday / d.totalTeachers) * 100 : 0);
  const weekAvg = d.weekAttendance.length ? clampPercent(d.weekAttendance.reduce((sum, item) => sum + item.value, 0) / d.weekAttendance.length) : 0;
  const recentActivities = [
    ...d.recentStudents.map((student) => ({
      title: "New student admission",
      meta: student.name,
      icon: UserPlus,
      tone: "bg-[#edf1ff] text-[#2e38a4]"
    })),
    ...d.notices.map((notice) => ({
      title: notice.title,
      meta: `Notice · ${notice.meta}`,
      icon: Megaphone,
      tone: "bg-[#fff4df] text-[#c67711]"
    }))
  ].slice(0, 5);

  return (
    <section className="space-y-5 p-4 md:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total Students"
          value={d.totalStudents.toLocaleString("en-IN")}
          helper={d.totalStudents ? "Active student records" : "No students yet"}
          icon={UsersRound}
          tone="bg-[#edf1ff] text-[#2e38a4]"
        />
        <MetricCard
          label="Staff Attendance"
          value={`${attendancePct}%`}
          helper={`${d.presentToday}/${d.totalTeachers} present today`}
          icon={ClipboardCheck}
          tone="bg-[#e9f8f0] text-[#0d8f5b]"
        />
        <MetricCard
          label="Fee Collection"
          value={formatINR(d.feesCollected)}
          helper={`${collectedPct}% of ${formatINR(d.totalFeeAmount)}`}
          icon={IndianRupee}
          tone="bg-[#fff4df] text-[#c67711]"
        />
        <MetricCard
          label="Outstanding Dues"
          value={formatINR(d.feesOutstanding)}
          helper={`${d.studentsPending} pending account${d.studentsPending === 1 ? "" : "s"}`}
          helperTone="text-[#d1485c]"
          icon={BellRing}
          tone="bg-[#fff0f2] text-[#d1485c]"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.78fr)_minmax(270px,0.82fr)]">
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-[#20233f]">Staff Attendance · Last 7 Days</h2>
              <p className="mt-1 text-xs font-semibold text-[#7d86a8]">Daily present and late staff count as attendance coverage.</p>
            </div>
            <span className="rounded-full bg-[#edf1ff] px-3 py-1.5 text-xs font-extrabold text-[#3540c0]">Average {weekAvg}%</span>
          </div>
          <AttendanceTrend data={d.weekAttendance} />
        </Panel>

        <Panel className="p-5">
          <h2 className="text-base font-extrabold text-[#20233f]">Fee Collection Overview</h2>
          <div className="mt-6 flex flex-col items-center gap-5">
            <div className="grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(#3137b7 0 ${collectedPct}%, #e7ebf6 ${collectedPct}% 100%)` }}>
              <div className="grid h-[102px] w-[102px] place-items-center rounded-full bg-white text-center shadow-inner">
                <span className="text-3xl font-extrabold text-[#252a87]">{collectedPct}%</span>
                <span className="-mt-7 text-xs font-bold text-[#7d86a8]">Collected</span>
              </div>
            </div>
            <div className="grid w-full gap-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-[#f8faff] px-3 py-2">
                <span className="flex items-center gap-2 font-bold text-[#657092]"><span className="h-2.5 w-2.5 rounded-sm bg-[#3137b7]" />Collected</span>
                <strong className="text-[#20233f]">{formatINR(d.feesCollected)}</strong>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-[#f8faff] px-3 py-2">
                <span className="flex items-center gap-2 font-bold text-[#657092]"><span className="h-2.5 w-2.5 rounded-sm bg-[#e7ebf6]" />Pending</span>
                <strong className="text-[#20233f]">{formatINR(d.feesOutstanding)}</strong>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#20233f]">Recent Activity</h2>
            <Link href="/admin/notifications" className="text-xs font-extrabold text-[#3540c0] hover:underline">View all</Link>
          </div>
          <div className="mt-4 space-y-1">
            {recentActivities.length === 0 ? (
              <div className="rounded-lg bg-[#f8faff] px-4 py-8 text-center text-sm font-semibold text-[#7d86a8]">No recent activity yet</div>
            ) : (
              recentActivities.map((activity, index) => (
                <ActivityItem key={`${activity.title}-${index}`} {...activity} />
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div>
            <h2 className="text-base font-extrabold text-[#20233f]">Quick Actions</h2>
            <p className="mt-1 text-xs font-semibold text-[#7d86a8]">Common super-admin workflows in one tap.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {quickActions.filter(Boolean).map((action) => (
            <QuickAction key={action.label} {...action} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#edf1ff] text-[#2e38a4]"><ClipboardCheck size={20} /></span>
            <div>
              <p className="text-xs font-bold text-[#7d86a8]">Today&apos;s Attendance</p>
              <p className="mt-1 text-sm font-extrabold text-[#20233f]">Present: {d.presentToday}</p>
              <p className="text-xs font-bold text-[#d1485c]">Pending: {Math.max(0, d.totalTeachers - d.presentToday)}</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e9f8f0] text-[#0d8f5b]"><Wallet size={20} /></span>
            <div>
              <p className="text-xs font-bold text-[#7d86a8]">Today&apos;s Collections</p>
              <p className="mt-1 text-sm font-extrabold text-[#20233f]">{formatINR(d.feesCollectedToday)}</p>
              <p className="text-xs font-bold text-[#657092]">Recorded today</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#fff0f2] text-[#d1485c]"><ShieldCheck size={20} /></span>
            <div>
              <p className="text-xs font-bold text-[#7d86a8]">Pending Approvals</p>
              <p className="mt-1 text-sm font-extrabold text-[#20233f]">{d.studentsPending}</p>
              <p className="text-xs font-bold text-[#657092]">Review fee follow-ups</p>
            </div>
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#fff4df] text-[#c67711]"><CalendarDays size={20} /></span>
            <div>
              <p className="text-xs font-bold text-[#7d86a8]">Upcoming Events</p>
              <p className="mt-1 text-sm font-extrabold text-[#20233f]">{d.notices.length}</p>
              <p className="text-xs font-bold text-[#657092]">Recent notices</p>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.8fr)]">
        <section>
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-[#20233f]">More Powerful Modules</h2>
            <p className="mt-1 text-xs font-semibold text-[#7d86a8]">Everything the office team needs, organized by task.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {moduleShortcuts.filter(Boolean).map((module) => (
              <ModuleShortcut key={module.label} {...module} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3">
            <h2 className="text-base font-extrabold text-[#20233f]">System Management</h2>
            <p className="mt-1 text-xs font-semibold text-[#7d86a8]">Safety checks and control settings.</p>
          </div>
          <div className="grid gap-3">
            <Link href="/admin/settings" className="dashboard-animate rounded-lg border border-[#e1e7f4] bg-white p-4 shadow-[0_8px_18px_rgba(31,42,116,0.04)] transition hover:-translate-y-0.5 hover:border-[#c7d1ec]">
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#edf1ff] text-[#2e38a4]"><Settings size={20} /></span>
                <span>
                  <span className="block text-sm font-extrabold text-[#20233f]">Settings</span>
                  <span className="text-xs font-semibold text-[#7d86a8]">Role access, rules, and school setup</span>
                </span>
              </span>
            </Link>
            <Link href="/admin/backup" className="dashboard-animate rounded-lg border border-[#e1e7f4] bg-white p-4 shadow-[0_8px_18px_rgba(31,42,116,0.04)] transition hover:-translate-y-0.5 hover:border-[#c7d1ec]">
              <span className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#e9f8f0] text-[#0d8f5b]"><ShieldCheck size={20} /></span>
                <span>
                  <span className="block text-sm font-extrabold text-[#20233f]">Backup & Restore</span>
                  <span className="text-xs font-semibold text-[#7d86a8]">Keep critical records protected</span>
                </span>
              </span>
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
}
