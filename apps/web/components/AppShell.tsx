"use client";

import clsx from "clsx";
import {
  BellRing,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  Grid2X2,
  IndianRupee,
  Loader2,
  LogOut,
  Megaphone,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  ROLE_LABELS,
  canAccessModule,
  isValidRole,
  modulesForRole,
  type Module,
  type Role
} from "@sri-narayana/shared";
import { auth, db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { AcademicYearProvider, useAcademicYears } from "@/components/AcademicYearContext";
import { AdminSessionProvider } from "@/components/AdminSessionContext";
import { BrandLoader } from "@/components/BrandLoader";

type NavChild = { href: string; label: string; module?: Module };
type NavItem = { href: string; label: string; module: Module; icon: LucideIcon; children?: NavChild[] };

const primaryNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", module: "dashboard", icon: Grid2X2 },
  { href: "/admin/students", label: "Students", module: "students", icon: Users },
  { href: "/admin/teachers", label: "Staff", module: "staff", icon: GraduationCap },
  {
    href: "/admin/attendance",
    label: "Attendance",
    module: "attendance",
    icon: ClipboardCheck,
    children: [{ href: "/admin/reports", label: "Attendance Reports", module: "reports" }]
  },
  {
    href: "/admin/payments",
    label: "Fees & Finance",
    module: "fees",
    icon: IndianRupee,
    children: [
      { href: "/admin/fee-concessions", label: "Fee Concessions" },
      { href: "/admin/fee-reports", label: "Fee Reports" }
    ]
  },
  { href: "/admin/salary", label: "Salary & Payroll", module: "payroll", icon: Wallet },
  { href: "/admin/notifications", label: "Communication", module: "communication", icon: Megaphone },
  { href: "/admin/academic-years", label: "Academic Years", module: "academic_years", icon: CalendarRange },
  { href: "/admin/users", label: "Users & Roles", module: "users", icon: UserCog },
  { href: "/admin/portal", label: "Portal", module: "portal", icon: ShieldCheck }
];

const secondaryNav: NavItem[] = [
  {
    href: "/admin/calendar",
    label: "Timetable",
    module: "academics",
    icon: CalendarDays,
    children: [{ href: "/admin/holidays", label: "Holidays" }]
  },
  {
    href: "/admin/settings",
    label: "Settings",
    module: "settings",
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
  "/admin/academic-years": "Academic Years",
  "/admin/users": "Users & Roles",
  "/admin/portal": "Portal",
  "/admin/settings": "Settings",
  "/admin/biometric": "Biometric Devices",
  "/admin/backup": "Backup & Restore"
};

const routeModules: Array<{ prefix: string; module: Module }> = [
  { prefix: "/admin/fee-concessions", module: "fees" },
  { prefix: "/admin/fee-reports", module: "fees" },
  { prefix: "/admin/academic-years", module: "academic_years" },
  { prefix: "/admin/teachers", module: "staff" },
  { prefix: "/admin/attendance", module: "attendance" },
  { prefix: "/admin/reports", module: "reports" },
  { prefix: "/admin/payments", module: "fees" },
  { prefix: "/admin/salary", module: "payroll" },
  { prefix: "/admin/notifications", module: "communication" },
  { prefix: "/admin/calendar", module: "academics" },
  { prefix: "/admin/holidays", module: "academics" },
  { prefix: "/admin/settings", module: "settings" },
  { prefix: "/admin/biometric", module: "settings" },
  { prefix: "/admin/backup", module: "settings" },
  { prefix: "/admin/students", module: "students" },
  { prefix: "/admin/users", module: "users" },
  { prefix: "/admin/portal", module: "portal" },
  { prefix: "/admin/dashboard", module: "dashboard" }
];

function moduleForPath(pathname: string): Module | undefined {
  return routeModules.find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))?.module;
}

function navForRole(items: NavItem[], role?: Role): NavItem[] {
  const allowed = new Set(modulesForRole(role));
  return items
    .filter((item) => allowed.has(item.module))
    .map((item) => ({
      ...item,
      children: item.children?.filter((child) => !child.module || allowed.has(child.module))
    }));
}

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

function HeaderDateLabel({ now }: { now: Date | null }) {
  const { activeYear } = useAcademicYears();
  if (!now) return <>{"\u00a0"}</>;

  const dateText = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  return <>{dateText} · Academic Year {activeYear?.name ?? academicYearLabel(now)}</>;
}

function AcademicYearSwitcher() {
  const { years, activeYear, loading, error, canSwitchYear, activateYear } = useAcademicYears();
  const [changing, setChanging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const value = activeYear?.id ?? "";
  const disabled = loading || changing || years.length === 0 || !canSwitchYear;

  const handleChange = async (yearId: string) => {
    if (!yearId || yearId === activeYear?.id) return;
    setChanging(true);
    setLocalError(null);
    try {
      await activateYear(yearId);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Unable to switch academic year");
    } finally {
      setChanging(false);
    }
  };

  return (
    <div className="relative hidden min-w-[172px] md:block" title={localError ?? error ?? undefined}>
      <CalendarRange size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8490b9]" />
      <select
        aria-label="Academic year"
        className="h-11 w-full appearance-none rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] pl-10 pr-9 text-sm font-bold text-[#20223a] outline-none transition focus:border-[#4a4bb1] focus:ring-4 focus:ring-[#4a4bb1]/10 disabled:cursor-not-allowed disabled:text-[#8b94b2]"
        value={value}
        disabled={disabled}
        onChange={(event) => void handleChange(event.target.value)}
      >
        {years.length === 0 ? (
          <option value="">{loading ? "Loading..." : "No academic year"}</option>
        ) : (
          <>
            {!activeYear && <option value="">No active year</option>}
            {years.map((year) => (
              <option key={year.id ?? year.name} value={year.id ?? ""}>
                {year.isActive ? `${year.name} (Active)` : year.name}
              </option>
            ))}
          </>
        )}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8490b9]">
        {changing ? <Loader2 size={15} className="animate-spin" /> : <ChevronDown size={15} />}
      </span>
    </div>
  );
}

function AccessDeniedState({ module }: { module?: Module }) {
  return (
    <section className="p-4 md:p-7">
      <div className="card flex max-w-2xl items-start gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
          <ShieldAlert size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">
            Your role does not have permission to open {module ? module.replace("_", " ") : "this page"}.
          </p>
        </div>
      </div>
    </section>
  );
}

type Profile = { uid: string; name: string; email?: string; role?: Role };

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

  // Signed-in user, synced from the `users/{uid}` profile doc (falls back to
  // the Firebase Auth display name / email).
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setSessionLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setSessionLoading(true);
      if (!user) {
        setProfile(null);
        setSessionLoading(false);
        return;
      }
      let name = user.displayName ?? "";
      let role: Role | undefined;
      try {
        const token = await user.getIdTokenResult();
        if (isValidRole(token.claims.role)) role = token.claims.role;
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          const data = snapshot.data() as { displayName?: string; role?: unknown };
          if (data.displayName) name = data.displayName;
          if (!role && isValidRole(data.role)) role = data.role;
        }
      } catch {
        // Keep the auth-based fallback if the profile read fails.
      }
      if (!name) name = user.email ?? "User";
      setProfile({ uid: user.uid, name, email: user.email ?? undefined, role });
      setSessionLoading(false);
    });
    return unsubscribe;
  }, []);

  const role = profile?.role;
  const sessionValue = useMemo(() => ({ profile, role, loading: sessionLoading }), [profile, role, sessionLoading]);
  const mainNav = useMemo(() => navForRole(primaryNav, role), [role]);
  const generalNav = useMemo(() => navForRole(secondaryNav, role), [role]);
  const currentModule = moduleForPath(pathname);
  const routeDenied = !sessionLoading && Boolean(currentModule && (!role || !canAccessModule(role, currentModule)));
  const roleLabel = role ? ROLE_LABELS[role] : "Loading...";

  const handleSignOut = () => {
    if (!isFirebaseConfigured) {
      router.replace("/login");
      return;
    }
    signOut(auth).then(() => router.replace("/login"));
  };

  return (
    <AdminSessionProvider value={sessionValue}>
      <AcademicYearProvider>
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
          {mainNav.map((item) => (
            <NavEntry key={item.href} item={item} pathname={pathname} />
          ))}

          {generalNav.length > 0 && (
            <>
              <p className="hidden px-2 pb-2 pt-7 text-[11px] font-bold tracking-[0.13em] text-[#9ba9ed] md:block">GENERAL</p>
              {generalNav.map((item) => (
                <NavEntry key={item.href} item={item} pathname={pathname} />
              ))}
            </>
          )}
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
            <span className="block text-xs text-[#aeb9f2]">{roleLabel}</span>
          </span>
          <LogOut size={19} className="text-[#bdc8ff]" />
        </button>
      </aside>

      <main key={pathname} className="min-w-0 flex-1 md:ml-[276px] flex flex-col">
        <header className="sticky top-0 z-20 flex min-h-[76px] items-center gap-4 border-b border-[#e4e6f0] bg-white/95 px-4 py-3 backdrop-blur md:px-7 flex-shrink-0">
          <div className="min-w-[170px]">
            <h1 className="text-xl font-extrabold tracking-tight text-[#15172d]">{title}</h1>
            <p className="text-xs font-medium text-[#7b85a8]"><HeaderDateLabel now={now} /></p>
          </div>
          <label className="relative ml-auto hidden max-w-[330px] flex-1 lg:block">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8490b9]" />
            <input
              aria-label="Search school records"
              placeholder="Search students, fees, notices..."
              className="h-11 w-full rounded-xl border border-[#e0e3f0] bg-[#f4f5fb] pl-12 pr-4 text-sm text-[#242744] outline-none placeholder:text-[#99a2c3] focus:border-[#4a4bb1] focus:ring-4 focus:ring-[#4a4bb1]/10"
            />
          </label>
          <AcademicYearSwitcher />
          <button type="button" className="hidden h-11 items-center gap-3 rounded-xl border border-[#e0e3f0] bg-[#f8f8fc] px-4 text-sm font-bold text-[#20223a] sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#eef0ff] text-[#292b8d]"><ClipboardCheck size={17} /></span>
            {profile?.name ?? "Administrator"}
            <ChevronDown size={16} />
          </button>
          {role && canAccessModule(role, "communication") && (
            <Link href="/admin/notifications" aria-label="Communication & notifications" className="relative grid h-11 w-11 place-items-center rounded-xl bg-[#f3f4fb] text-[#313581] transition hover:bg-[#e9ebfa]">
              <BellRing size={19} />
              <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-[#f05b62] ring-2 ring-[#f3f4fb]" />
            </Link>
          )}
        </header>
        <div key={pathname} className="page-enter flex-1 overflow-y-auto">
          {sessionLoading ? <BrandLoader message="Loading secure workspace…" /> : routeDenied ? <AccessDeniedState module={currentModule} /> : children}
        </div>
      </main>
    </div>
      </AcademicYearProvider>
    </AdminSessionProvider>
  );
}
