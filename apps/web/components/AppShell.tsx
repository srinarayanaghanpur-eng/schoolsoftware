"use client";

import clsx from "clsx";
import {
  BellRing,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  Grid2X2,
  IndianRupee,
  LogOut,
  Search,
  Settings,
  Users,
  Wallet
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";

type NavChild = { href: string; label: string };
type NavItem = { href: string; label: string; icon: typeof Grid2X2; children?: NavChild[] };

const primaryNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Grid2X2 },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/teachers", label: "Teachers", icon: GraduationCap },
  {
    href: "/admin/attendance",
    label: "Attendance",
    icon: ClipboardCheck,
    children: [{ href: "/admin/reports", label: "Attendance Reports" }]
  },
  {
    href: "/admin/payments",
    label: "Fees & Finance",
    icon: IndianRupee,
    children: [
      { href: "/admin/fee-concessions", label: "Fee Concessions" },
      { href: "/admin/fee-reports", label: "Fee Reports" }
    ]
  },
  { href: "/admin/salary", label: "Salary & Payroll", icon: Wallet }
];

const secondaryNav: NavItem[] = [
  {
    href: "/admin/calendar",
    label: "Timetable",
    icon: CalendarDays,
    children: [{ href: "/admin/holidays", label: "Holidays" }]
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    children: [
      { href: "/admin/biometric", label: "Biometric Devices" },
      { href: "/admin/backup", label: "Backup & Restore" }
    ]
  }
];

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/students": "Students",
  "/admin/teachers": "Teachers",
  "/admin/attendance": "Attendance",
  "/admin/reports": "Attendance Reports",
  "/admin/payments": "Fees & Finance",
  "/admin/fee-concessions": "Fee Concessions",
  "/admin/fee-reports": "Fee Reports",
  "/admin/salary": "Salary & Payroll",
  "/admin/notifications": "Communication",
  "/admin/calendar": "Timetable",
  "/admin/holidays": "Holidays",
  "/admin/settings": "Settings",
  "/admin/biometric": "Biometric Devices",
  "/admin/backup": "Backup & Restore"
};

function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = pathname === item.href;
  const childActive = item.children?.some((child) => pathname === child.href) ?? false;
  const [open, setOpen] = useState(active || childActive);

  return (
    <div>
      <div className="flex items-stretch">
        <Link
          href={item.href}
          className={clsx(
            "group relative flex flex-1 items-center gap-4 rounded-xl px-4 py-3 text-sm font-semibold transition duration-200",
            active
              ? "bg-[#4748a9] text-white shadow-[0_8px_20px_rgba(8,10,92,0.18)]"
              : "text-[#dce2ff] hover:bg-white/10 hover:text-white"
          )}
        >
          {active && <span className="absolute inset-y-3 -left-2 w-1 rounded-r-full bg-[#ffd23f]" />}
          <item.icon size={20} strokeWidth={2.4} className={active ? "text-white" : "text-[#c5ceff] group-hover:text-white"} />
          {item.label}
        </Link>
        {item.children && (
          <button
            type="button"
            aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="ml-1 grid w-9 shrink-0 place-items-center rounded-xl text-[#c5ceff] transition hover:bg-white/10 hover:text-white"
          >
            <ChevronDown size={16} className={clsx("transition-transform duration-200", open && "rotate-180")} />
          </button>
        )}
      </div>
      {item.children && open && (
        <div className="mt-1 space-y-1 pl-7">
          {item.children.map((child) => {
            const childIsActive = pathname === child.href;
            return (
              <Link
                key={child.href}
                href={child.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-4 py-2 text-[13px] font-semibold transition duration-200",
                  childIsActive ? "bg-white/15 text-white" : "text-[#b9c2ee] hover:bg-white/10 hover:text-white"
                )}
              >
                <span className={clsx("h-1.5 w-1.5 rounded-full", childIsActive ? "bg-[#ffd23f]" : "bg-[#6f78c4]")} />
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Academic year runs June → May, so June 2026 falls in "2026–27".
function academicYearLabel(date: Date) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 5 ? year : year - 1;
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Profile = { name: string; role: string };

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pageTitles[pathname] ?? "Administration";

  // Live, current date. Starts null so SSR and first client render match
  // (no hydration mismatch); filled on mount and refreshed every minute so it
  // always reflects "today".
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const dateLabel = now
    ? `${now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Academic Year ${academicYearLabel(now)}`
    : " ";

  // Signed-in user, synced from the `users/{uid}` profile doc (falls back to
  // the Firebase Auth display name / email).
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null);
        return;
      }
      let name = user.displayName ?? "";
      let role = "Administrator";
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          const data = snapshot.data() as { displayName?: string; role?: string };
          if (data.displayName) name = data.displayName;
          if (data.role) role = `${data.role.charAt(0).toUpperCase()}${data.role.slice(1)}`;
        }
      } catch {
        // Keep the auth-based fallback if the profile read fails.
      }
      if (!name) name = user.email ?? "User";
      setProfile({ name, role });
    });
    return unsubscribe;
  }, []);

  const handleSignOut = () => {
    if (!isFirebaseConfigured) {
      router.replace("/login");
      return;
    }
    signOut(auth).then(() => router.replace("/login"));
  };

  return (
    <div className="min-h-screen bg-[#f5f6fd] text-[#181a31] md:flex">
      <aside className="relative flex shrink-0 flex-col overflow-hidden bg-[linear-gradient(180deg,#292b8d_0%,#20226f_100%)] text-white md:fixed md:inset-y-0 md:w-[276px]">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-6 md:px-5">
          <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white p-1 shadow-lg shadow-black/10">
            <img src="/sri-narayana-high-school-logo.jpg" alt="Sri Narayana High School" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-serif text-lg font-bold leading-5 text-white">Sri Narayana</p>
            <p className="mt-0.5 text-[11px] font-medium tracking-[0.08em] text-[#c1c9ff]">HIGH SCHOOL · ERP</p>
          </div>
        </div>

        <nav className="nav-scroll flex gap-1 overflow-x-auto px-3 py-5 md:block md:min-h-0 md:flex-1 md:space-y-1 md:overflow-x-visible md:overflow-y-auto md:px-4">
          <p className="hidden px-2 pb-2 text-[11px] font-bold tracking-[0.13em] text-[#9ba9ed] md:block">MAIN</p>
          {primaryNav.map((item) => (
            <NavEntry key={item.href} item={item} pathname={pathname} />
          ))}

          <p className="hidden px-2 pb-2 pt-7 text-[11px] font-bold tracking-[0.13em] text-[#9ba9ed] md:block">GENERAL</p>
          {secondaryNav.map((item) => (
            <NavEntry key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-auto hidden items-center gap-3 border-t border-white/10 px-5 py-5 text-left transition hover:bg-white/5 md:flex"
          title="Sign out"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#ffc73d] text-sm font-extrabold text-[#2a2c87]">
            {profile ? initialsOf(profile.name) : "··"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{profile?.name ?? "Loading…"}</span>
            <span className="block text-xs text-[#aeb9f2]">{profile?.role ?? "Administrator"}</span>
          </span>
          <LogOut size={19} className="text-[#bdc8ff]" />
        </button>
      </aside>

      <main key={pathname} className="min-w-0 flex-1 md:ml-[276px] flex flex-col">
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center gap-4 border-b border-[#e4e6f0] bg-white/95 px-4 py-3 backdrop-blur md:px-7 flex-shrink-0">
          <div className="min-w-[170px]">
            <h1 className="text-xl font-extrabold tracking-tight text-[#15172d]">{title}</h1>
            <p className="text-xs font-medium text-[#7b85a8]">{dateLabel}</p>
          </div>
          <label className="relative ml-auto hidden max-w-[330px] flex-1 lg:block">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8490b9]" />
            <input
              aria-label="Search school records"
              placeholder="Search students, fees, notices..."
              className="h-11 w-full rounded-xl border border-[#e0e3f0] bg-[#f4f5fb] pl-12 pr-4 text-sm text-[#242744] outline-none placeholder:text-[#99a2c3] focus:border-[#4a4bb1] focus:ring-4 focus:ring-[#4a4bb1]/10"
            />
          </label>
          <button type="button" className="hidden h-11 items-center gap-3 rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-4 text-sm font-bold text-[#20223a] sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#eef0ff] text-[#292b8d]"><ClipboardCheck size={17} /></span>
            {profile?.name ?? "Administrator"}
            <ChevronDown size={16} />
          </button>
          <Link href="/admin/notifications" aria-label="Communication & notifications" className="relative grid h-11 w-11 place-items-center rounded-xl bg-[#f3f4fb] text-[#313581] transition hover:bg-[#e9ebfa]">
            <BellRing size={19} />
            <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-[#f05b62] ring-2 ring-[#f3f4fb]" />
          </Link>
        </header>
        <div key={pathname} className="page-enter flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
