import Link from "next/link";
import {
  BellRing,
  BookOpenCheck,
  ClipboardCheck,
  CreditCard,
  Megaphone,
  Plus,
  Settings,
  UserPlus,
  UsersRound
} from "lucide-react";
import { adminDb } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const quickActions = [
  { href: "/admin/attendance", label: "Take Attendance", helper: "Mark today's roll", icon: ClipboardCheck, tone: "bg-[#eef0ff] text-[#3033a0]" },
  { href: "/admin/payments", label: "Record Payment", helper: "Collect a fee", icon: CreditCard, tone: "bg-[#e7f8ef] text-[#10a65d]" },
  { href: "/admin/students", label: "Student Records", helper: "Browse & admit", icon: UserPlus, tone: "bg-[#fff4df] text-[#e29813]" },
  { href: "/admin/notifications", label: "Post Notice", helper: "Notify parents", icon: Megaphone, tone: "bg-[#ffeaec] text-[#dd5369]" },
  { href: "/admin/settings", label: "Settings", helper: "Configure school", icon: Settings, tone: "bg-[#f3f4fb] text-[#313581]" }
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istDateKey(date: Date) {
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

function formatINR(amount: number) {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

type DashboardData = {
  totalStudents: number;
  totalTeachers: number;
  presentToday: number;
  feesCollected: number;
  feesOutstanding: number;
  totalFeeAmount: number;
  studentsPending: number;
  weekAttendance: { day: string; value: number }[];
  recentStudents: { name: string; cls: string; initials: string }[];
  notices: { title: string; meta: string }[];
};

async function loadDashboard(): Promise<DashboardData> {
  const db = adminDb();
  const today = istDateKey(new Date());
  const weekAgo = istDateKey(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [studentsSnap, teachersSnap, weekAttSnap, noticesSnap, paymentsSnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("teachers").where("status", "==", "active").get(),
    db.collection("attendance").where("date", ">=", weekAgo).get(),
    db.collection("notifications").orderBy("createdAt", "desc").limit(3).get().catch(() => null),
    db.collection("payments").get()
  ]);

  const students = studentsSnap.docs.map((d) => d.data());
  const totalTeachers = teachersSnap.size;

  // "Fees Collected" reads from the `payments` transaction log — the single
  // source of truth that Finance also uses — so the dashboard and Finance
  // always agree. (Per-student `totalFeesPaid` is a cache and can drift.)
  const feesCollected = paymentsSnap.docs.reduce((s, d) => s + (Number(d.data().amountPaid) || 0), 0);
  const feesOutstanding = students.reduce((s, st) => s + Math.max(0, (st.totalFeesDue || 0) - (st.totalFeesPaid || 0)), 0);
  const totalFeeAmount = students.reduce((s, st) => s + (st.totalFeeAmount || 0), 0);
  const studentsPending = students.filter((st) => Math.max(0, (st.totalFeesDue || 0) - (st.totalFeesPaid || 0)) > 0).length;

  const present = (status?: string) => status === "present" || status === "late";
  const byDay = new Map<string, { present: number }>();
  let presentToday = 0;
  weekAttSnap.docs.forEach((d) => {
    const a = d.data();
    if (a.date === today && present(a.status)) presentToday++;
    const entry = byDay.get(a.date) ?? { present: 0 };
    if (present(a.status)) entry.present++;
    byDay.set(a.date, entry);
  });

  const weekAttendance = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000);
    const key = istDateKey(d);
    const presentCount = byDay.get(key)?.present ?? 0;
    return { day: DAY_LABELS[d.getDay()], value: totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 0 };
  });

  const recentStudents = students
    .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))
    .slice(0, 3)
    .map((st) => {
      const name = st.studentName || "Unknown";
      return {
        name: `${name}${st.class ? ` · Class ${st.class}${st.section || ""}` : ""}`,
        cls: st.class || "",
        initials: name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "?"
      };
    });

  const notices = (noticesSnap?.docs ?? []).map((d) => {
    const n = d.data();
    return { title: n.title || n.message || "Notice", meta: n.createdAt ? new Date(n.createdAt).toLocaleDateString("en-IN") : "" };
  });

  return {
    totalStudents: students.length,
    totalTeachers,
    presentToday,
    feesCollected,
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
  helperTone = "text-[#13a961]",
  icon: Icon,
  tone,
  delay = 0
}: {
  label: string;
  value: string;
  helper: string;
  helperTone?: string;
  icon: typeof UsersRound;
  tone: string;
  delay?: number;
}) {
  return (
    <article className="dashboard-animate rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(36,42,94,0.09)]" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#7d86a8]">{label}</p>
        <span className={`grid h-10 w-10 place-items-center rounded-xl ${tone}`}><Icon size={20} strokeWidth={2.25} /></span>
      </div>
      <p className="mt-3 text-[34px] font-extrabold leading-none tracking-tight text-[#1b1d32]">{value}</p>
      <p className={`mt-2 text-sm font-semibold ${helperTone}`}>{helper}</p>
    </article>
  );
}

export default async function AdminDashboardPage() {
  const data = await loadDashboard().catch(() => null);

  const d: DashboardData = data ?? {
    totalStudents: 0, totalTeachers: 0, presentToday: 0, feesCollected: 0, feesOutstanding: 0,
    totalFeeAmount: 0, studentsPending: 0, weekAttendance: DAY_LABELS.slice(0, 7).map((day) => ({ day, value: 0 })),
    recentStudents: [], notices: []
  };

  const collectedPct = d.totalFeeAmount > 0 ? Math.round((d.feesCollected / d.totalFeeAmount) * 100) : 0;
  const attendancePct = d.totalTeachers > 0 ? Math.round((d.presentToday / d.totalTeachers) * 100) : 0;
  const weekAvg = d.weekAttendance.length ? Math.round(d.weekAttendance.reduce((s, x) => s + x.value, 0) / d.weekAttendance.length) : 0;
  const maxBar = Math.max(100, ...d.weekAttendance.map((x) => x.value));

  return (
    <section className="space-y-5 p-4 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight text-[#1b1d32]">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Students" value={d.totalStudents.toLocaleString("en-IN")} helper={`${d.totalStudents === 0 ? "No students yet" : "Enrolled students"}`} helperTone="text-[#7d86a8]" icon={UsersRound} tone="bg-[#eeefff] text-[#3033a1]" delay={30} />
        <MetricCard label="Present Today" value={`${d.presentToday}/${d.totalTeachers}`} helper={d.totalTeachers ? `${attendancePct}% staff attendance` : "No staff yet"} helperTone="text-[#7d86a8]" icon={ClipboardCheck} tone="bg-[#e6f8ef] text-[#14a762]" delay={70} />
        <MetricCard label="Fees Collected" value={formatINR(d.feesCollected)} helper={d.totalFeeAmount ? `${collectedPct}% of ${formatINR(d.totalFeeAmount)}` : "No fees recorded"} icon={CreditCard} tone="bg-[#eeefff] text-[#3033a1]" delay={110} />
        <MetricCard label="Pending Dues" value={formatINR(d.feesOutstanding)} helper={`${d.studentsPending} student${d.studentsPending === 1 ? "" : "s"} pending`} helperTone="text-[#ed515d]" icon={BellRing} tone="bg-[#ffebed] text-[#ed515d]" delay={150} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <article className="dashboard-animate rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)] md:p-6" style={{ animationDelay: "190ms" }}>
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-bold text-[#23253a]">Staff attendance — last 7 days</h2>
            <span className="text-sm font-bold text-[#7c86a7]">Avg {weekAvg}%</span>
          </div>
          <div className="mt-5 flex h-[172px] items-end justify-between gap-3 px-1 sm:gap-5">
            {d.weekAttendance.map((item, index) => (
              <div key={`${item.day}-${index}`} className="flex h-full min-w-7 flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-[145px] w-full items-end justify-center">
                  <span
                    className={`dashboard-bar w-full max-w-[52px] rounded-t-[9px] ${item.value === 0 ? "bg-[#e5e8f4]" : "bg-[linear-gradient(180deg,#4548bd_0%,#2b2e91_100%)]"}`}
                    style={{ height: `${Math.max(4, (item.value / maxBar) * 100)}%`, animationDelay: `${240 + index * 40}ms` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#8a93b1]">{item.day}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-animate rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)] md:p-6" style={{ animationDelay: "230ms" }}>
          <h2 className="font-bold text-[#23253a]">Fee Collection</h2>
          <div className="mt-5 flex items-center justify-center gap-6 sm:gap-8 xl:justify-start">
            <div className="dashboard-pulse grid h-[140px] w-[140px] shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(#2d3094 0 ${collectedPct}%, #e6e9f5 ${collectedPct}% 100%)` }}>
              <div className="grid h-[100px] w-[100px] place-items-center rounded-full bg-white text-center">
                <span className="text-[27px] font-extrabold tracking-tight text-[#272a73]">{collectedPct}%</span>
                <span className="-mt-5 text-xs font-semibold text-[#7f89a8]">collected</span>
              </div>
            </div>
            <div className="space-y-4 text-sm">
              <p className="flex items-start gap-2"><span className="mt-1 h-3 w-3 rounded bg-[#2d3094]" /><span><span className="block font-semibold text-[#848cab]">Collected</span><strong className="text-lg text-[#22243a]">{formatINR(d.feesCollected)}</strong></span></p>
              <p className="flex items-start gap-2"><span className="mt-1 h-3 w-3 rounded bg-[#e6e9f5]" /><span><span className="block font-semibold text-[#848cab]">Pending</span><strong className="text-lg text-[#22243a]">{formatINR(d.feesOutstanding)}</strong></span></p>
            </div>
          </div>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickActions.map(({ href, label, helper, icon: Icon, tone }, index) => (
          <Link key={label} href={href} className="dashboard-animate group flex items-center gap-3 rounded-2xl border border-[#e3e6f0] bg-white p-4 shadow-[0_2px_4px_rgba(36,42,94,0.03)] transition hover:-translate-y-0.5 hover:border-[#c7caf0] hover:shadow-[0_10px_22px_rgba(36,42,94,0.08)]" style={{ animationDelay: `${280 + index * 38}ms` }}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone} transition group-hover:scale-105`}><Icon size={21} /></span>
            <span className="min-w-0"><span className="block font-bold leading-5 text-[#1f2136]">{label}</span><span className="block text-sm text-[#7d86a8]">{helper}</span></span>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_0.95fr]">
        <article className="dashboard-animate rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)]" style={{ animationDelay: "400ms" }}>
          <div className="flex items-center justify-between"><h2 className="font-bold text-[#23253a]">Recent Admissions</h2><Link href="/admin/students" className="text-sm font-bold text-[#3436a2] hover:underline">View all</Link></div>
          <div className="mt-4 divide-y divide-[#edf0f7]">
            {d.recentStudents.length === 0 ? (
              <p className="py-6 text-center text-sm font-medium text-[#8790ae]">No admissions yet</p>
            ) : (
              d.recentStudents.map((student, index) => (
                <div key={`${student.name}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#eef0ff] text-xs font-extrabold text-[#3436a2]">{student.initials}</span><span className="flex-1 text-sm font-semibold text-[#303247]">{student.name}</span></div>
              ))
            )}
          </div>
        </article>
        <article className="dashboard-animate rounded-2xl border border-[#e3e6f0] bg-white p-5 shadow-[0_2px_4px_rgba(36,42,94,0.03)]" style={{ animationDelay: "450ms" }}>
          <div className="flex items-center justify-between"><h2 className="font-bold text-[#23253a]">Notice Board</h2><Link href="/admin/notifications" className="text-sm font-bold text-[#3436a2] hover:underline">All</Link></div>
          {d.notices.length === 0 ? (
            <p className="mt-4 rounded-xl bg-[#f5f6fd] p-4 text-center text-sm font-medium text-[#8790ae]">No notices posted yet</p>
          ) : (
            d.notices.map((notice, index) => (
              <div key={`${notice.title}-${index}`} className="mt-4 flex gap-3 rounded-xl bg-[#f5f6fd] p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#fff1d9] text-[#d79418]"><BookOpenCheck size={18} /></span><span><span className="block text-sm font-bold text-[#303247]">{notice.title}</span><span className="text-xs font-medium text-[#7d86a8]">{notice.meta}</span></span></div>
            ))
          )}
          <Link href="/admin/notifications" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#3436a2]"><Plus size={16} /> Create a notice</Link>
        </article>
      </div>
    </section>
  );
}
