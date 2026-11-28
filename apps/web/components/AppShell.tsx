"use client";

import clsx from "clsx";
import {
  BellRing,
  BookOpenCheck,
  Bus,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardCheck,
  Download,
  FileText,
  GraduationCap,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  Phone,
  RefreshCw,
  Settings,
  ShieldAlert,
  UserCircle,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ROLE_LABELS,
  SCHOOL_CONTACT,
  canAccessModuleFromList,
  hasPermission,
  hasPermissionFromList,
  modulesForRoleFromList,
  type Module,
  type Permission,
  type Role
} from "@sri-narayana/shared";
import { auth, db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { AcademicYearProvider, useAcademicYears } from "@/components/AcademicYearContext";
import { useAuth } from "@/components/AuthProvider";
import FloatingCalculator from "@/components/finance/FloatingCalculator";
import LogoutConfirmDialog from "@/components/LogoutConfirmDialog";
import { AdminSessionProvider } from "@/components/AdminSessionContext";
import AppLoader from "@/components/AppLoader";
import { LiveClock } from "@/components/LiveClock";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { KeyboardShortcuts, type ShortcutItem } from "@/components/KeyboardShortcuts";
import { SectionTabs } from "@/components/SectionTabs";
import { API_STATUS_EVENT } from "@/lib/adminApiClient";
import { refreshClaims } from "@/lib/authClaims";
import { isDesktopApp, onDesktopNotificationNavigate, showDesktopNotification } from "@/lib/desktopBridge";
import { isRoleAllowedForPath } from "@/lib/routeAccess";
import { lazyLoad } from "@/lib/lazyLoad";
import { adminNavigationGroups, type NavigationGroup, type NavigationItem } from "@/lib/navigation";

type NavChild = { href: string; label: string; module?: Module };
type NavItem = {
  href: string;
  label: string;
  module: Module;
  icon: LucideIcon;
  children?: NavChild[];
  badge?: number;
  activePrefixes?: string[];
};
type ContextSubnavItem = { href: string; label: string; icon: LucideIcon; module?: Module; activePrefixes?: string[] };
type ContextSubnav = {
  title: string;
  eyebrow: string;
  matchPrefixes: string[];
  items: ContextSubnavItem[];
};
const APPROVAL_BADGE_POLL_MS = 15 * 60 * 1000;
const COMMUNICATION_BADGE_POLL_MS = 15 * 60 * 1000;
const COMMUNICATION_BADGE_COUNT_EVENT = "snhs-communication-pending-count";
const APPROVAL_BADGE_QUOTA_PAUSE_MS = 10 * 60 * 1000;
const APPROVAL_BADGE_QUOTA_PAUSE_KEY = "sriNarayana.approvalBadgeQuotaPauseUntil";

function isApprovalBadgePausedForQuota() {
  try {
    return Number(window.localStorage.getItem(APPROVAL_BADGE_QUOTA_PAUSE_KEY) ?? "0") > Date.now();
  } catch {
    return false;
  }
}

function pauseApprovalBadgeAfterQuota() {
  try {
    window.localStorage.setItem(APPROVAL_BADGE_QUOTA_PAUSE_KEY, String(Date.now() + APPROVAL_BADGE_QUOTA_PAUSE_MS));
  } catch {
    // Local storage can be blocked; the in-memory interval guard still stops polling.
  }
}

function noticeTargetsRole(audienceRoles: unknown, role: Role): boolean {
  if (!Array.isArray(audienceRoles) || audienceRoles.length === 0) return true;
  const roles = audienceRoles.map((item) => String(item).toLowerCase());
  const current = String(role).toLowerCase();
  if (roles.includes(current)) return true;
  if (current === "teacher" && roles.includes("teachers")) return true;
  return false;
}

const MAIN_NAV_COLLAPSED_KEY = "snhs-main-nav-collapsed-v1";
const CONTEXT_SUBNAV_COLLAPSED_KEY = "snhs-context-subnav-collapsed-v2";
const SUB_SIDEBAR_COMPACT_QUERY = "(max-width: 1023px)";
const FallbackIcon = Circle;

// Calculator lives under Fees & Finance only (same prefixes as the nav item).
const FINANCE_CALC_PREFIXES = [
  "/admin/finance",
  "/admin/payments",
  "/admin/fee-structures",
  "/admin/fee-concessions",
  "/admin/fee-reminders",
  "/admin/fee-fine-rules",
  "/admin/fee-challans"
];

// Parent/student portal nav — shown only for portal roles. Admin roles have the
// "portal" module via their wildcard grant, so these must NOT be merged into
// the admin navigation or they leak into the portal sidebar (duplicate Dashboard, etc.).
const portalNav: NavItem[] = [
  { href: "/portal", label: "Dashboard", module: "portal", icon: LayoutDashboard },
  { href: "/portal/homework", label: "Homework", module: "portal", icon: BookOpenCheck, activePrefixes: ["/portal/homework"] },
  { href: "/portal/fees", label: "Fees", module: "portal", icon: IndianRupee },
  { href: "/portal/exams", label: "Exams", module: "portal", icon: GraduationCap },
  { href: "/portal/online-exams", label: "Online Tests", module: "portal", icon: FileText },
  { href: "/portal/notices", label: "Notices", module: "portal", icon: Megaphone },
  { href: "/portal/calendar", label: "Calendar", module: "portal", icon: CalendarDays },
  { href: "/portal/transport", label: "Transport", module: "portal", icon: Bus },
  { href: "/portal/downloads", label: "Downloads", module: "portal", icon: Download },
  { href: "/portal/contact", label: "Contact", module: "portal", icon: MessageSquare },
  { href: "/portal/profile", label: "Profile", module: "portal", icon: UserCircle }
];

const portalMobileTabs = [
  { href: "/portal", label: "Dashboard", short: "Home", icon: LayoutDashboard, module: "portal" as Module },
  { href: "/portal/homework", label: "Homework", short: "HW", icon: BookOpenCheck, module: "portal" as Module },
  { href: "/portal/fees", label: "Fees", short: "Fees", icon: IndianRupee, module: "portal" as Module },
  { href: "/portal/exams", label: "Exams", short: "Exams", icon: GraduationCap, module: "portal" as Module }
];

const adminMobileTabs = [
  { href: "/admin/dashboard", label: "Summary", short: "Home", icon: LayoutDashboard, module: "dashboard" as Module },
  { href: "/admin/students", label: "Students", short: "Students", icon: Users, module: "students" as Module },
  { href: "/admin/attendance", label: "Attendance", short: "Attendance", icon: ClipboardCheck, module: "attendance" as Module },
  { href: "/admin/finance", label: "Finance", short: "Finance", icon: IndianRupee, module: "fees" as Module }
];

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/my-attendance": "My Attendance",
  "/admin/notices": "Notices",
  "/admin/students": "Students",
  "/admin/student-records": "Student Records",
  "/admin/academics/assignments": "Subject Assignments",
  "/admin/online-exams": "Online Exams",
  "/admin/parents": "Parents",
  "/admin/teachers": "Teachers",
  "/admin/attendance": "Attendance",
  "/admin/reports": "Reports",
  "/admin/payments": "Fees & Finance",
  "/admin/finance/income": "Other Income",
  "/admin/fee-structures": "Fee Structures",
  "/admin/fee-fine-rules": "Fee Fine Rules",
  "/admin/masters": "Setup & Masters",
  "/admin/fee-challans": "Fee Challans",
  "/admin/finance/carry-forward": "Fees Carry Forward",
  "/admin/finance/due-slips": "Due Slips",
  "/admin/fee-reminders": "Fee Reminders",
  "/admin/fee-concessions": "Fee Concessions",
  "/admin/salary": "Salary & Payroll",
  "/admin/notifications": "Communication",
  "/admin/messages": "Parent Messages",
  "/admin/communications": "SMS & WhatsApp",
  "/admin/calendar": "Timetable",
  "/admin/holidays": "Holidays",
  "/admin/settings/academic-years": "Academic Years",
  "/admin/promotions": "Promotion",
  "/admin/users": "Users & Roles",
  "/admin/approvals": "Approvals",
  "/portal": "Dashboard",
  "/portal/attendance": "Attendance",
  "/portal/homework": "Homework",
  "/portal/payments": "Payment History",
  "/portal/payments/receipt": "Receipt",
  "/portal/fees": "Fee Management",
  "/portal/exams": "Examinations",
  "/portal/online-exams": "Online Tests",
  "/portal/notices": "Notices & Circulars",
  "/portal/calendar": "School Calendar",
  "/portal/transport": "Transport Details",
  "/portal/downloads": "Downloads",
  "/portal/contact": "Contact School",
  "/portal/profile": "Parent Profile",
  "/admin/profile": "My Profile",
  "/admin/settings": "Settings Manager",
  "/admin/settings/activity-logs": "Activity Log",
  "/admin/biometric": "Biometric Devices",
  "/admin/backup": "Backup & Restore",
  "/admin/report-cards": "Report Cards",
  "/admin/homework": "Homework",
  "/admin/timetable": "Timetable",
  "/admin/certificates": "Certificates",
  "/admin/id-cards": "ID Cards",
  "/admin/transport/trips": "Driver Trips",
  "/admin/transport/live-map": "Live Bus Map",
  "/admin/ai-agent": "AI Agent",
  "/admin/ai-agent/settings": "AI Settings",
  "/admin/ai-agent/logs": "AI Logs",
  "/admin/ai-agent/quota": "Quota & Usage"
};

const routeModules: Array<{ prefix: string; module: Module }> = [
  { prefix: "/admin/finance", module: "fees" },
  { prefix: "/admin/fee-concessions", module: "fees" },
  { prefix: "/admin/fee-structures", module: "fees" },
  { prefix: "/admin/fee-fine-rules", module: "fees" },
  { prefix: "/admin/fee-challans", module: "fees" },
  { prefix: "/admin/settings/academic-years", module: "academic_years" },
  { prefix: "/admin/teachers", module: "staff" },
  { prefix: "/admin/attendance", module: "attendance" },
  { prefix: "/admin/reports", module: "reports" },
  { prefix: "/admin/payments", module: "fees" },
  { prefix: "/admin/fee-reminders", module: "fee_reminders" },
  { prefix: "/admin/salary", module: "payroll" },
  { prefix: "/admin/notifications", module: "communication" },
  { prefix: "/admin/calendar", module: "academics" },
  { prefix: "/admin/holidays", module: "academics" },
  { prefix: "/admin/settings", module: "settings" },
  { prefix: "/admin/biometric", module: "settings" },
  { prefix: "/admin/backup", module: "settings" },
  { prefix: "/admin/promotions", module: "promotions" },
  { prefix: "/admin/students", module: "students" },
  { prefix: "/admin/student-records", module: "students" },
  { prefix: "/admin/parents", module: "parents" },
  { prefix: "/admin/messages", module: "communication" },
  { prefix: "/admin/communications", module: "communication" },
  { prefix: "/admin/approvals", module: "settings" },
  { prefix: "/admin/users", module: "users" },
  { prefix: "/portal", module: "portal" },
  { prefix: "/admin/dashboard", module: "dashboard" },
  { prefix: "/admin/ai-agent", module: "ai_agent" }
];

function moduleForPath(pathname: string): Module | undefined {
  return routeModules.find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))?.module;
}

function navForRole(items: Array<NavItem | null | undefined>, role?: Role, permissions?: readonly Permission[]): NavItem[] {
  const allowed = new Set(modulesForRoleFromList(role, permissions));
  return items
    .filter((item): item is NavItem => Boolean(item?.href && item.label && item.module))
    // Must pass BOTH the module RBAC matrix and the route table, so we never
    // show a link the route guard would deny (e.g. Fees & Finance to principal,
    // Settings to admin). Keeps the sidebar consistent with actual access.
    .filter((item) => allowed.has(item.module) && isRoleAllowedForPath(item.href, role))
    .map((item) => ({
      ...item,
      icon: item.icon ?? FallbackIcon,
      children: item.children?.filter(
        (child) =>
          Boolean(child?.href && child.label) &&
          (!child.module || allowed.has(child.module)) &&
          isRoleAllowedForPath(child.href, role)
      )
    }));
}

function isPathActive(pathname: string, href: string, prefixes: string[] = []) {
  return pathname === href || pathname.startsWith(`${href}/`) || prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isSubSidebarCompactViewport() {
  return typeof window !== "undefined" && window.matchMedia(SUB_SIDEBAR_COMPACT_QUERY).matches;
}

function NavEntry({ item, pathname, onNavigate, rail = false }: { item: NavItem; pathname: string; onNavigate?: () => void; rail?: boolean }) {
  const active = isPathActive(pathname, item.href, item.activePrefixes);
  const childActive = item.children?.some((child) => isPathActive(pathname, child.href)) ?? false;
  const [open, setOpen] = useState(active || childActive);
  const Icon = item.icon ?? FallbackIcon;

  return (
    <div>
      <div className="flex items-stretch">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          aria-label={rail ? item.label : undefined}
          title={rail ? item.label : undefined}
          className={clsx(
            "group relative flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition duration-200",
            rail && "md:justify-center md:px-0 md:py-3",
            active
              ? "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_8px_18px_rgba(5,8,55,0.18)]"
              : "text-[#d7defb] hover:bg-white/[0.09] hover:text-white"
          )}
        >
          {active && <span className="absolute inset-y-2 -left-2 w-1 rounded-r-full bg-[#f7c948] md:-left-2" />}
          <Icon size={rail ? 21 : 19} strokeWidth={2.35} className={active ? "text-white" : "text-[#bbc6ff] group-hover:text-white"} />
          <span className={clsx("flex-1", rail && "md:hidden")}>{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#ffd23f] px-1.5 text-[10px] font-extrabold text-[#20226f]">
              {item.badge > 99 ? "99+" : item.badge}
            </span>
          )}
        </Link>
        {item.children && (
          <button
            type="button"
            aria-label={open ? `Collapse ${item.label}` : `Expand ${item.label}`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="ml-1 grid w-8 shrink-0 place-items-center rounded-lg text-[#c5ceff] transition hover:bg-white/10 hover:text-white"
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
                onClick={onNavigate}
                aria-current={childIsActive ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-[12px] font-semibold transition duration-200",
                  childIsActive ? "bg-white/[0.15] text-white" : "text-[#b9c2ee] hover:bg-white/10 hover:text-white"
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

function SubSidebarToggleButton({
  title,
  collapsed,
  drawerOpen,
  onToggle,
  className
}: {
  title: string;
  collapsed: boolean;
  drawerOpen: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const expanded = drawerOpen ? drawerOpen : !collapsed;
  const ToggleIcon = expanded ? ChevronLeft : ChevronRight;
  const actionLabel = expanded ? `Hide ${title} navigation` : `Show ${title} navigation`;

  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-expanded={expanded}
      data-sub-sidebar-toggle-button
      onClick={onToggle}
      className={clsx(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/40 print:hidden",
        className
      )}
    >
      <ToggleIcon size={18} strokeWidth={2.55} />
    </button>
  );
}

function ContextualSubnav({
  subnav,
  pathname,
  collapsed,
  drawerOpen,
  mainNavCollapsed,
  onCloseDrawer,
  onToggle
}: {
  subnav: ContextSubnav;
  pathname: string;
  collapsed: boolean;
  drawerOpen: boolean;
  mainNavCollapsed: boolean;
  onCloseDrawer: () => void;
  onToggle: () => void;
}) {
  const railOffset = mainNavCollapsed ? "left-0" : "left-[80px]";
  const drawerOffset = mainNavCollapsed ? "md:left-0" : "md:left-[80px]";
  const drawerHiddenOffset = mainNavCollapsed ? "md:-translate-x-full" : "md:-translate-x-[calc(100%+80px)]";
  const items = (subnav.items ?? []).filter((item): item is ContextSubnavItem => Boolean(item?.href && item.label));

  const renderLinks = (onNavigate?: () => void, interactive = true) => (
    <nav aria-label={`${subnav.title} navigation`} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map(({ href, label, icon, activePrefixes }) => {
        const active = isPathActive(pathname, href, activePrefixes);
        const Icon = icon ?? FallbackIcon;
        return (
          <Link
            key={`${href}-${label}`}
            href={href}
            onClick={onNavigate}
            tabIndex={interactive ? undefined : -1}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-bold transition",
              active
                ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted hover:text-accent-foreground"
            )}
          >
            {active && <span className="absolute inset-y-2 -left-3 w-1 rounded-r-full bg-primary" />}
            <span className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg", active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:text-primary")}>
              <Icon size={16} strokeWidth={2.35} />
            </span>
            <span className="min-w-0 truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  const header = () => (
    <div className="flex min-h-[73px] items-start gap-3 border-b border-border px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{subnav.eyebrow}</p>
        <h2 className="mt-0.5 truncate text-lg font-extrabold tracking-tight text-foreground">{subnav.title}</h2>
      </div>
      <SubSidebarToggleButton
        title={subnav.title}
        collapsed={collapsed}
        drawerOpen={drawerOpen}
        onToggle={onToggle}
      />
    </div>
  );

  return (
    <>
      <aside
        aria-hidden={collapsed}
        className={clsx(
          "fixed inset-y-0 z-40 hidden w-[232px] flex-col border-r border-border bg-card shadow-xl transition-[transform,opacity] duration-300 ease-out lg:flex print:hidden",
          railOffset,
          collapsed ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100"
        )}
      >
        {header()}
        {renderLinks(undefined, !collapsed)}
      </aside>

      <aside
        aria-hidden={!collapsed}
        aria-label={`${subnav.title} collapsed navigation`}
        className={clsx(
          "fixed inset-y-0 z-30 hidden w-12 flex-col border-r border-border bg-card shadow-sm transition-[transform,opacity] duration-300 ease-out lg:flex print:hidden",
          railOffset,
          collapsed ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"
        )}
      >
        <div className="flex min-h-[73px] items-start justify-center border-b border-border px-1.5 py-4">
          <SubSidebarToggleButton
            title={subnav.title}
            collapsed={collapsed}
            drawerOpen={false}
            onToggle={onToggle}
          />
        </div>
      </aside>

      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={onCloseDrawer}
          className="fixed inset-0 z-30 bg-[#0a103a]/35 backdrop-blur-[2px] lg:hidden print:hidden"
        />
      )}

      <aside
        aria-hidden={!drawerOpen}
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[86vw] flex-col border-r border-border bg-card shadow-2xl transition-transform duration-300 ease-out lg:hidden print:hidden",
          drawerOffset,
          drawerOpen ? "translate-x-0" : `pointer-events-none -translate-x-full ${drawerHiddenOffset}`
        )}
      >
        {header()}
        {renderLinks(onCloseDrawer, drawerOpen)}
      </aside>
    </>
  );
}

// Academic year runs June → May, so June 2026 falls in "2026–27".
function academicYearLabel(date: Date) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 5 ? year : year - 1;
  return `${startYear}–${String(startYear + 1).slice(-2)}`;
}

function greetingForHour(hour: number | undefined): string {
  if (hour === undefined) return "Dashboard";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function initialsOf(name: string) {  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function HeaderDateLabel({ now }: { now: Date | null }) {
  const { selectedYear } = useAcademicYears();
  if (!now) return <>{"\u00a0"}</>;

  const dateText = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  return <>{dateText} · Academic Year {selectedYear?.name ?? academicYearLabel(now)}</>;
}

function AcademicYearBadge() {
  const { selectedYear, loading, years, setSelectedYear } = useAcademicYears();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative hidden md:block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-w-[172px] items-center gap-2.5 rounded-lg border border-border bg-input px-3.5 py-2.5 text-left transition hover:border-accent-number"
        title="Switch academic year"
      >
        <CalendarRange size={17} className="shrink-0 text-[#8490b9]" />
        <span className="flex-1 truncate text-sm font-bold text-foreground">
          {selectedYear ? `AY ${selectedYear.name}` : loading ? "Loading..." : "No academic year"}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-border bg-card p-2 shadow-xl">
          <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Switch academic year</p>
          <div className="mt-1 max-h-48 overflow-y-auto space-y-0.5">
            {years.length === 0 ? (
              <p className="px-2 py-3 text-center text-sm font-medium text-muted-foreground">{loading ? "Loading..." : "No academic years"}</p>
            ) : (
              years.map((year) => (
                <button
                  key={year.id}
                  type="button"
                  onClick={() => { if (year.id) setSelectedYear(year.id); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted ${selectedYear?.id === year.id ? "bg-accent font-bold text-accent-foreground" : "font-medium text-foreground"}`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${year.isActive ? "bg-[#13a961]" : "bg-[#d0d5e8]"}`} />
                  <span className="flex-1 truncate">{year.name}</span>
                  {year.isActive && <span className="text-[10px] font-bold uppercase text-[#13a961]">Active</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
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
          <h2 className="text-lg font-extrabold text-foreground">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Your role does not have permission to open {module ? module.replace("_", " ") : "this page"}.
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Global network status banner. States:
 *  - online: hidden
 *  - offline: amber, "Offline — showing saved data"
 *  - reconnecting: blue, shown briefly after connectivity returns
 *  - stale/failed: gray/red, when an API call failed (with Retry)
 * Driven by browser online/offline events plus API_STATUS_EVENT emitted by
 * adminApiClient whenever a request fails or is served from cache.
 */
type NetStatus = "online" | "offline" | "reconnecting" | "stale" | "failed";

function OfflineBanner() {
  const [status, setStatus] = useState<NetStatus>("online");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const handleOffline = () => {
      clearTimer();
      setStatus("offline");
    };
    const handleOnline = () => {
      clearTimer();
      setStatus("reconnecting");
      // Show "reconnecting" briefly, then clear.
      timerRef.current = setTimeout(() => setStatus("online"), 2500);
    };
    const handleApiStatus = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      // Browser-level offline state wins over per-request signals.
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (type === "ok") {
        setStatus((prev) => (prev === "stale" || prev === "failed" ? "online" : prev));
      } else if (type === "stale-served" || type === "request-failed") {
        setStatus(type === "stale-served" ? "stale" : "failed");
        // Auto-dismiss: a single failed request shouldn't leave a permanent
        // red bar. It reappears if the next request fails too.
        clearTimer();
        timerRef.current = setTimeout(() => setStatus("online"), 8000);
      }
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) setStatus("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(API_STATUS_EVENT, handleApiStatus);
    return () => {
      clearTimer();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(API_STATUS_EVENT, handleApiStatus);
    };
  }, []);

  if (status === "online") return null;

  const config: Record<Exclude<NetStatus, "online">, { className: string; text: string; retry?: boolean }> = {
    offline: {
      className: "bg-amber-500",
      text: "Offline — showing saved data. Changes will not sync until you reconnect."
    },
    reconnecting: { className: "bg-sky-600", text: "Back online — refreshing data…" },
    stale: {
      className: "bg-slate-600",
      text: "Connection problem — showing saved data.",
      retry: true
    },
    failed: { className: "bg-rose-600", text: "Request failed.", retry: true }
  };
  const { className, text, retry } = config[status];

  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 px-4 py-1.5 text-center text-xs font-extrabold text-white shadow-md print:hidden ${className}`}
    >
      <span>{text}</span>
      {retry && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-[28px] rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wide transition hover:bg-white/30"
        >
          Retry
        </button>
      )}
      {status !== "offline" && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => setStatus("online")}
          className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm font-bold leading-none transition hover:bg-white/25"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = pathname.startsWith("/admin/finance")
    ? "Finance / Accounts"
    : pageTitles[pathname] ?? "Administration";
  const contentRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(pathname);
  useEffect(() => {
    if (previousPathRef.current === pathname) return;
    previousPathRef.current = pathname;
    const frame = window.requestAnimationFrame(() => contentRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  // Live, current date. Starts null so SSR and first client render match
  // (no hydration mismatch); filled on mount and refreshed every minute so it
  // always reflects "today".
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const { status: authStatus, profile, role, permissions: rolePermissions, signOutAndClear } = useAuth();
  const sessionLoading = authStatus === "checking";
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => setProfileMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [profileMenuOpen]);

  // Pending approval count badge
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const previousApprovalsRef = useRef<number | null>(null);
  useEffect(() => {
    return onDesktopNotificationNavigate((route) => router.push(route));
  }, [router]);
  useEffect(() => {
    if (!isFirebaseConfigured || !role || !canAccessModuleFromList(role, rolePermissions, "settings") || !isRoleAllowedForPath("/admin/approvals", role)) {
      setPendingApprovals(0);
      return;
    }
    if (isApprovalBadgePausedForQuota()) {
      setPendingApprovals(0);
      return;
    }
    let stopped = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const fetchCount = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setPendingApprovals(0);
          return;
        }
        const res = await fetch("/api/admin/approvals?status=pending&count=1", {
          headers: { authorization: `Bearer ${token}` }
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; count?: unknown; code?: string } | null;
        if (!res.ok) {
          if (res.status === 429 || data?.code === "quota-exceeded") {
            stopped = true;
            pauseApprovalBadgeAfterQuota();
            if (interval) clearInterval(interval);
          }
          setPendingApprovals(0);
          return;
        }
        const count = Number(data?.count ?? 0);
        const next = data?.ok && Number.isFinite(count) ? count : 0;
        setPendingApprovals(next);
        const previous = previousApprovalsRef.current;
        previousApprovalsRef.current = next;
        if (previous !== null && next > previous) {
          const added = next - previous;
          void showDesktopNotification({
            title: "New approval request",
            body: added === 1 ? "A new request needs your approval." : `${added} new requests need your approval.`,
            route: "/admin/approvals"
          });
        }
      } catch {
        setPendingApprovals(0);
      }
    };
    void fetchCount();
    interval = setInterval(fetchCount, APPROVAL_BADGE_POLL_MS);
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };
  }, [role, rolePermissions]);

  const [pendingCommunicationRequests, setPendingCommunicationRequests] = useState(0);
  const previousCommunicationRef = useRef<number | null>(null);
  useEffect(() => {
    const handlePendingCountUpdate = (event: Event) => {
      const count = Number((event as CustomEvent<{ pendingCount?: unknown }>).detail?.pendingCount ?? 0);
      setPendingCommunicationRequests(Number.isFinite(count) ? count : 0);
    };

    window.addEventListener(COMMUNICATION_BADGE_COUNT_EVENT, handlePendingCountUpdate);
    return () => window.removeEventListener(COMMUNICATION_BADGE_COUNT_EVENT, handlePendingCountUpdate);
  }, []);

  useEffect(() => {
    if (
      !isFirebaseConfigured ||
      !role ||
      role !== "super_admin" ||
      !canAccessModuleFromList(role, rolePermissions, "communication") ||
      !isRoleAllowedForPath("/admin/notifications", role)
    ) {
      setPendingCommunicationRequests(0);
      return;
    }

    let stopped = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const fetchCount = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setPendingCommunicationRequests(0);
          return;
        }

        const res = await fetch("/api/admin/communication/requests?count=1", {
          headers: { authorization: `Bearer ${token}` }
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; pendingCount?: unknown } | null;
        if (!res.ok) {
          setPendingCommunicationRequests(0);
          return;
        }

        const count = Number(data?.pendingCount ?? 0);
        const next = data?.ok && Number.isFinite(count) ? count : 0;
        setPendingCommunicationRequests(next);
        const previous = previousCommunicationRef.current;
        previousCommunicationRef.current = next;
        if (previous !== null && next > previous) {
          const added = next - previous;
          void showDesktopNotification({
            title: "New communication request",
            body: added === 1 ? "A new request is waiting in Notifications." : `${added} new requests are waiting in Notifications.`,
            route: "/admin/notifications"
          });
        }
      } catch {
        setPendingCommunicationRequests(0);
      }
    };

    void fetchCount();
    interval = setInterval(fetchCount, COMMUNICATION_BADGE_POLL_MS);
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };
  }, [role, rolePermissions]);

  useEffect(() => {
    if (!isDesktopApp() || !isFirebaseConfigured || !role) return;
    const noticesQuery = query(collection(db, "notices"), orderBy("createdAt", "desc"), limit(5));
    const knownIds = new Set<string>();
    let ready = false;
    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const snapshot = await getDocs(noticesQuery);
        if (stopped) return;
        const latest = snapshot.docs[0];
        if (!ready) {
          ready = true;
          for (const doc of snapshot.docs) knownIds.add(doc.id);
          return;
        }
        if (!latest) return;
        const isNew = !knownIds.has(latest.id);
        for (const doc of snapshot.docs) knownIds.add(doc.id);
        if (!isNew) return;

        const data = latest.data() as { title?: unknown; body?: unknown; audienceRoles?: unknown };
        if (!noticeTargetsRole(data.audienceRoles, role)) return;
        void showDesktopNotification({
          title: typeof data.title === "string" && data.title.trim() ? data.title : "New school notice",
          body:
            typeof data.body === "string" && data.body.trim()
              ? data.body.slice(0, 180)
              : "A new notice has been published.",
          route: "/admin/notices"
        });
      } catch {
        // A failed poll must not affect the rest of the app.
      }
    };

    void check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [role]);

  // Mobile slide-in nav drawer. Closes automatically on navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setMobileNavOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const frame = window.requestAnimationFrame(() => {
      mobileNavRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileNavOpen]);

  const [mainNavCollapsed, setMainNavCollapsed] = useState(false);
  const [mainNavPreferenceLoaded, setMainNavPreferenceLoaded] = useState(false);
  const [contextSubnavCollapsed, setContextSubnavCollapsed] = useState(false);
  const [contextSubnavPreferenceLoaded, setContextSubnavPreferenceLoaded] = useState(false);
  const [contextSubnavDrawerOpen, setContextSubnavDrawerOpen] = useState(false);
  useEffect(() => {
    try {
      setMainNavCollapsed(window.localStorage.getItem(MAIN_NAV_COLLAPSED_KEY) === "true");
    } catch {
      // Local storage can be blocked; the UI still works for this session.
    } finally {
      setMainNavPreferenceLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!mainNavPreferenceLoaded) return;
    try {
      window.localStorage.setItem(MAIN_NAV_COLLAPSED_KEY, mainNavCollapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [mainNavCollapsed, mainNavPreferenceLoaded]);
  useEffect(() => {
    try {
      setContextSubnavCollapsed(window.localStorage.getItem(CONTEXT_SUBNAV_COLLAPSED_KEY) === "true");
    } catch {
      // Local storage can be blocked; the UI still works for this session.
    } finally {
      setContextSubnavPreferenceLoaded(true);
    }
  }, []);
  useEffect(() => {
    if (!contextSubnavPreferenceLoaded) return;
    try {
      window.localStorage.setItem(CONTEXT_SUBNAV_COLLAPSED_KEY, contextSubnavCollapsed ? "true" : "false");
    } catch {
      // ignore
    }
  }, [contextSubnavCollapsed, contextSubnavPreferenceLoaded]);
  useEffect(() => setContextSubnavDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!mobileNavOpen && !contextSubnavDrawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      const wasMobileOpen = mobileNavOpen;
      setMobileNavOpen(false);
      setContextSubnavDrawerOpen(false);
      if (wasMobileOpen) {
        window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileNavOpen, contextSubnavDrawerOpen]);

  // The accountant has no use for the admin dashboard — send them straight to
  // Finance as their home so they don't land on (or see the URL of) /admin/dashboard.
  useEffect(() => {
    if (!sessionLoading && role === "accountant" && pathname === "/admin/dashboard") {
      router.replace("/admin/finance");
    }
  }, [sessionLoading, role, pathname, router]);

  const sessionValue = useMemo(() => ({
    profile,
    role,
    permissions: rolePermissions,
    loading: sessionLoading || signingOut,
    hasPermission: (permission: Permission) => {
      if (!role) return false;
      if (role === "super_admin") return true;
      if (rolePermissions && rolePermissions.length > 0) {
        return hasPermissionFromList(role, rolePermissions, permission);
      }
      return hasPermission(role, permission);
    }
  }), [profile, role, rolePermissions, sessionLoading, signingOut]);
  const isPortalRole = role === "parent";
  const allowedAdminItem = useMemo(
    () => (item: NavigationItem) => {
      if (item.module && (!role || !canAccessModuleFromList(role, rolePermissions, item.module))) return false;
      return isRoleAllowedForPath(item.href, role);
    },
    [role, rolePermissions]
  );
  const visibleAdminGroups = useMemo<NavigationGroup[]>(() => {
    if (isPortalRole) return [];
    return adminNavigationGroups
      .map((group) => ({
        ...group,
        items: group.items.filter(allowedAdminItem),
        searchItems: (group.searchItems ?? group.items).filter(allowedAdminItem)
      }))
      .filter((group) => group.items.length > 0);
  }, [allowedAdminItem, isPortalRole]);
  const mainNav = useMemo<NavItem[]>(() => {
    if (isPortalRole) return navForRole(portalNav, role, rolePermissions);
    return visibleAdminGroups.map((group) => {
      const first = group.items[0];
      return {
        href: first.href,
        label: group.label,
        module: first.module ?? group.module,
        icon: group.icon,
        activePrefixes: group.activePrefixes,
        badge: group.id === "admin" ? pendingApprovals : undefined
      };
    });
  }, [role, rolePermissions, isPortalRole, visibleAdminGroups, pendingApprovals]);
  const contextualSubnav = useMemo(() => {
    if (isPortalRole) return null;
    const group = adminNavigationGroups.find((candidate) =>
      candidate.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    );
    if (!group) return null;

    const allowedItems = group.items.filter(allowedAdminItem);

    return allowedItems.length > 0
      ? { title: group.label, eyebrow: group.eyebrow, matchPrefixes: group.matchPrefixes, items: allowedItems }
      : null;
  }, [pathname, isPortalRole, allowedAdminItem]);
  useEffect(() => {
    if (!contextualSubnav) setContextSubnavDrawerOpen(false);
  }, [contextualSubnav]);
  const bottomTabs = useMemo<Array<{ href: string; label: string; short: string; icon: LucideIcon; module?: Module; action?: "more" }>>(() => {
    const source = isPortalRole ? portalMobileTabs : adminMobileTabs;
    const allowed = source.filter((item) => {
      if (item.module && (!role || !canAccessModuleFromList(role, rolePermissions, item.module))) return false;
      return isRoleAllowedForPath(item.href, role);
    });
    return [...allowed, { href: "", label: "More", short: "More", icon: Menu, module: undefined, action: "more" as const }];
  }, [role, rolePermissions, isPortalRole]);
  const shortcutItems = useMemo<ShortcutItem[]>(() => {
    const result: ShortcutItem[] = [];
    const seen = new Set<string>();
    const add = (href: string, label: string, group: string, module?: Module) => {
      if (!href || !label) return;
      if (module && (!role || !canAccessModuleFromList(role, rolePermissions, module))) return;
      if (!isRoleAllowedForPath(href, role)) return;
      const key = `${href}::${label}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ href, label, group });
    };

    if (isPortalRole) {
      portalNav.forEach((item) => add(item.href, item.label, "Portal", item.module));
      return result;
    }

    visibleAdminGroups.forEach((group) => {
      (group.searchItems ?? group.items).forEach((item) => add(item.href, item.label, group.label, item.module));
    });
    Object.entries(pageTitles).forEach(([href, label]) => {
      if (href.startsWith("/portal")) return;
      add(href, label, "All pages", moduleForPath(href));
    });
    return result;
  }, [role, rolePermissions, isPortalRole, visibleAdminGroups]);
  const currentModule = moduleForPath(pathname);
  // Denied if EITHER the module RBAC matrix OR the central route table blocks the
  // current path. The route table covers the sensitive sub-areas (finance,
  // settings, users, roles) that the coarse module check alone would let through.
  const routeDenied =
    !sessionLoading &&
    !signingOut &&
    ((Boolean(currentModule) && (!role || !canAccessModuleFromList(role, rolePermissions, currentModule!))) ||
      !isRoleAllowedForPath(pathname, role));
  const roleLabel = role ? ROLE_LABELS[role] : "Loading...";
  const notificationLabel =
    pendingCommunicationRequests > 0
      ? `Communication & notifications, ${pendingCommunicationRequests} pending`
      : "Communication & notifications";

  const toggleMainNav = () => {
    setMobileNavOpen(false);
    setMainNavCollapsed((value) => !value);
  };

  const toggleSubSidebar = () => {
    setMobileNavOpen(false);
    if (!isSubSidebarCompactViewport()) {
      setContextSubnavDrawerOpen(false);
      setContextSubnavCollapsed((value) => !value);
      return;
    }

    if (contextSubnavDrawerOpen) {
      setContextSubnavDrawerOpen(false);
      return;
    }

    setContextSubnavCollapsed(false);
    setContextSubnavDrawerOpen(true);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setConfirmingSignOut(false);
    setSigningOut(true);
    try {
      await signOutAndClear();
    } finally {
      router.replace("/login?loggedOut=1");
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleHardRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // Clear all cached app data so the reload pulls everything fresh.
      await lazyLoad.clearCache();

      // Refresh auth claims so any updated roles/permissions take effect,
      // without forcing the user to sign in again.
      if (auth.currentUser) {
        await refreshClaims(auth.currentUser);
      }

      // Best-effort: drop any cached service-worker responses too.
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch (error) {
      console.error("Hard refresh cleanup failed:", error);
    } finally {
      // Full reload of the whole app. Firebase auth is persisted, so the
      // session survives and the user stays logged in.
      window.location.reload();
    }
  };

  return (
    <AdminSessionProvider value={sessionValue}>
      <AcademicYearProvider>
    <div className="erp-app min-h-screen bg-background text-foreground md:flex print:block print:bg-white">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineBanner />
      {/* Mobile backdrop */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[85vw] flex-col overflow-hidden bg-[linear-gradient(180deg,#17217f_0%,#11195f_100%)] text-white shadow-2xl transition-[transform,visibility,width,opacity] duration-300 ease-out md:max-w-none md:visible md:shadow-[12px_0_28px_rgba(18,27,105,0.12)] md:translate-x-0 print:hidden",
          mainNavCollapsed ? "md:w-0 md:border-r-0 md:opacity-0 md:pointer-events-none" : "md:w-[80px]",
          mobileNavOpen ? "visible translate-x-0" : "invisible -translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5 md:justify-center md:px-0">
          <div className="theme-preserve-light grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1 shadow-lg shadow-black/10">
            <img src="/sri-narayana-high-school-logo.jpg" alt="Sri Narayana High School" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1 md:hidden">
            <p className="truncate font-serif text-base font-bold leading-5 text-white">NarayanaOS</p>
            <p className="mt-0.5 text-[10px] font-bold tracking-[0.08em] text-[#b7c3ff]">SRI NARAYANA HIGH SCHOOL</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close menu"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#c5ceff] transition hover:bg-white/10 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mobile: full role-filtered navigation */}
        <nav
          id="mobile-navigation"
          ref={mobileNavRef}
          aria-label="Main navigation"
          className="nav-scroll min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 md:hidden"
        >
          {mainNav.length === 0 ? (
            <p className="px-3 py-4 text-sm font-semibold text-[#b9c2ee]">No modules are assigned to this account.</p>
          ) : (
            <div className="space-y-1">
              <p className="px-3 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8fa0ed]">
                {isPortalRole ? "Portal" : "Modules"}
              </p>
              {mainNav.map((item) => (
                <NavEntry key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
              ))}
            </div>
          )}
        </nav>

        {/* Desktop: thin module rail */}
        <nav aria-label="Module navigation" className="nav-scroll hidden min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 py-4 md:block">
          {mainNav.map((item) => (
            <NavEntry key={item.href} item={item} pathname={pathname} rail />
          ))}
        </nav>
        <div className="hidden border-t border-white/10 p-2 md:block">
          <button
            type="button"
            onClick={toggleMainNav}
            aria-label="Collapse main navigation"
            title="Collapse main navigation"
            className="flex w-full items-center justify-center rounded-lg py-2 text-[#c5ceff] transition hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </aside>

      {contextualSubnav && (
        <ContextualSubnav
          subnav={contextualSubnav}
          pathname={pathname}
          collapsed={contextSubnavCollapsed}
          drawerOpen={contextSubnavDrawerOpen}
          mainNavCollapsed={mainNavCollapsed}
          onCloseDrawer={() => setContextSubnavDrawerOpen(false)}
          onToggle={toggleSubSidebar}
        />
      )}

      <main
        key={pathname}
        className={clsx(
          "flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-out print:ml-0 print:block",
          // Sidebar is a fixed 80px icon rail. The contextual sub-nav (lg only)
          // sits between the rail and content: 232px expanded / 48px collapsed.
          mainNavCollapsed
            ? !contextualSubnav
              ? "md:ml-0"
              : contextSubnavCollapsed
                ? "md:ml-0 lg:ml-[48px]"
                : "md:ml-0 lg:ml-[232px]"
            : !contextualSubnav
              ? "md:ml-[80px]"
              : contextSubnavCollapsed
                ? "md:ml-[80px] lg:ml-[128px]"
                : "md:ml-[80px] lg:ml-[312px]"
        )}
      >
        <header className="sticky top-0 z-20 flex min-h-[64px] shrink-0 items-center gap-3 border-b border-border bg-card/90 px-3 py-2.5 shadow-sm backdrop-blur md:min-h-[72px] md:gap-4 md:px-6 md:py-3 print:hidden">
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => {
              setContextSubnavDrawerOpen(false);
              setMobileNavOpen(true);
            }}
            aria-label="Open menu"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-navigation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition hover:bg-muted md:hidden"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            onClick={toggleMainNav}
            aria-label={mainNavCollapsed ? "Expand main navigation" : "Collapse main navigation"}
            aria-expanded={!mainNavCollapsed}
            title={mainNavCollapsed ? "Expand main navigation" : "Collapse main navigation"}
            className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition hover:bg-muted md:grid md:h-11 md:w-11"
          >
            {mainNavCollapsed ? <ChevronRight size={19} /> : <ChevronLeft size={19} />}
          </button>
          <div className="min-w-0 flex-1 md:min-w-[170px]">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground md:text-xl">
              {pathname === "/admin/dashboard" ? greetingForHour(now?.getHours()) : title}
            </h1>
            <p className="truncate text-xs font-medium text-muted-foreground"><HeaderDateLabel now={now} /></p>
          </div>
          <AcademicYearBadge />
          <LiveClock className="hidden sm:inline-flex" />
          <DarkModeToggle />
          {role && canAccessModuleFromList(role, rolePermissions, "communication") && (
            <Link
              href="/admin/notifications"
              aria-label={notificationLabel}
              title={pendingCommunicationRequests > 0 ? `${pendingCommunicationRequests} pending request${pendingCommunicationRequests === 1 ? "" : "s"}` : "No pending requests"}
              className="relative grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground transition hover:bg-muted md:h-11 md:w-11"
            >
              <BellRing size={19} />
              {pendingCommunicationRequests > 0 && (
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-card md:right-3 md:top-3" />
              )}
            </Link>
          )}
          <button
            type="button"
            onClick={handleHardRefresh}
            disabled={refreshing}
            aria-label="Hard refresh app data"
            title="Hard refresh (clears cache & reloads the whole app)"
            className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 md:h-11 md:w-11"
          >
            <RefreshCw size={19} className={clsx(refreshing && "animate-spin")} />
          </button>
          <KeyboardShortcuts items={shortcutItems} />
          <div ref={profileMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Open profile menu"
              className="flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-1.5 text-left shadow-sm transition hover:border-primary/30 md:h-11 md:pl-2"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground">
                {profile ? initialsOf(profile.name) : "··"}
              </span>
              <span className="hidden min-w-0 xl:block">
                <span className="block max-w-[132px] truncate text-[12px] font-extrabold leading-4 text-foreground">{profile?.name ?? "User"}</span>
                <span className="block text-[10px] font-semibold leading-3 text-muted-foreground">{roleLabel}</span>
              </span>
              <ChevronDown size={16} className={clsx("shrink-0 text-muted-foreground transition", profileMenuOpen && "rotate-180")} />
            </button>
            {profileMenuOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-[70] w-64 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
                <div className="border-b border-border px-4 py-3">
                  <p className="truncate text-sm font-extrabold text-foreground">{profile?.name ?? "User"}</p>
                  <p className="truncate text-xs font-medium text-muted-foreground">{profile?.email ?? roleLabel}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/admin/profile"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                  >
                    <UserCircle size={17} /> My Profile
                  </Link>
                  {role && canAccessModuleFromList(role, rolePermissions, "settings") && isRoleAllowedForPath("/admin/settings", role) && (
                    <Link
                      href="/admin/settings"
                      role="menuitem"
                      onClick={() => setProfileMenuOpen(false)}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted"
                    >
                      <Settings size={17} /> Preferences
                    </Link>
                  )}
                </div>
                <div className="border-t border-border p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      setConfirmingSignOut(true);
                    }}
                    disabled={signingOut}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <LogOut size={17} /> Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
        {contextualSubnav && (
          <div className="flex min-h-[56px] items-center gap-3 border-b border-border bg-card px-3 py-2 shadow-sm md:px-6 lg:hidden print:hidden">
            <SubSidebarToggleButton
              title={contextualSubnav.title}
              collapsed={!contextSubnavDrawerOpen}
              drawerOpen={contextSubnavDrawerOpen}
              onToggle={toggleSubSidebar}
              className="h-10 w-10"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{contextualSubnav.eyebrow}</p>
              <p className="truncate text-sm font-extrabold text-foreground">{contextualSubnav.title}</p>
            </div>
          </div>
        )}
        <div
          key={pathname}
          id="main-content"
          ref={contentRef}
          tabIndex={-1}
          className="page-enter min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-[76px] outline-none md:pb-0 print:overflow-visible print:pb-0 print:opacity-100"
        >
          <ErrorBoundary resetKey={pathname}>
            {sessionLoading || signingOut ? <AppLoader message={signingOut ? "Signing out…" : "Preparing your workspace…"} /> : routeDenied ? <AccessDeniedState module={currentModule} /> : (<>{!contextualSubnav && <SectionTabs />}{children}</>)}
          </ErrorBoundary>
          {isPortalRole && !sessionLoading && !signingOut && (
            <footer className="mt-6 border-t border-border bg-card/60 px-4 py-6 text-center md:px-7">
              <p className="text-sm font-extrabold tracking-tight text-foreground">{SCHOOL_CONTACT.name}</p>
              <div className="mt-2 flex flex-col items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground sm:flex-row sm:gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <Phone size={13} className="text-primary" /> {SCHOOL_CONTACT.phone}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={13} className="text-primary" /> {SCHOOL_CONTACT.address}
                </span>
              </div>
              <p className="mt-3 text-xs font-medium text-muted-foreground">© 2026 Sri Narayana High School · Powered by NarayanaOS</p>
            </footer>
          )}
          {!isPortalRole && !sessionLoading && !signingOut && (
            <footer className="mt-6 border-t border-border px-4 py-4 text-center md:px-7 print:hidden">
              <p className="text-xs font-medium text-muted-foreground">© 2026 Sri Narayana High School · Powered by NarayanaOS</p>
            </footer>
          )}
        </div>
      </main>

      {/* Mobile bottom tab bar — quick access to the essentials */}
      <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        {bottomTabs.map((item) => {
          const Icon = item.icon ?? FallbackIcon;
          if (item.action === "more") {
            return (
              <button
                key="more"
                type="button"
                onClick={() => {
                  setContextSubnavDrawerOpen(false);
                  setMobileNavOpen(true);
                }}
                aria-label="Open all modules"
                aria-expanded={mobileNavOpen}
                className={clsx(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition",
                  mobileNavOpen ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon size={21} strokeWidth={mobileNavOpen ? 2.6 : 2.1} />
                <span className="leading-none">{item.short}</span>
              </button>
            );
          }
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-bold transition",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon size={21} strokeWidth={active ? 2.6 : 2.1} />
              <span className="leading-none">{item.short}</span>
            </Link>
          );
        })}
      </nav>
    </div>
      <FloatingCalculator role={role} visible={FINANCE_CALC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))} />
      <LogoutConfirmDialog
        open={confirmingSignOut}
        busy={signingOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={() => void handleSignOut()}
      />
      </AcademicYearProvider>
    </AdminSessionProvider>
  );
}
