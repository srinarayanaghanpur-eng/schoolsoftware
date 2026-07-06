"use client";

import clsx from "clsx";
import {
  Banknote,
  BarChart3,
  Bell,
  BellRing,
  BookOpen,
  BookOpenCheck,
  Building2,
  Bus,
  CalendarCheck,
  Hotel,
  Library,
  Package,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  Circle,
  ClipboardCheck,
  FileStack,
  FileText,
  GraduationCap,
  Grid2X2,
  IndianRupee,
  LayoutDashboard,
  Layers,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  Phone,
  ReceiptIndianRupee,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ScrollText,
  UserPlus,
  UserCircle,
  UserCog,
  Users,
  Wallet,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  ROLE_LABELS,
  SCHOOL_CONTACT,
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
import { LiveClock } from "@/components/LiveClock";
import { DarkModeToggle } from "@/components/DarkModeToggle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SectionTabs } from "@/components/SectionTabs";
import { clearPayrollSessionId } from "@/lib/payrollSessionClient";
import { API_STATUS_EVENT, clearAdminApiCacheForSignOut } from "@/lib/adminApiClient";
import { refreshClaims } from "@/lib/authClaims";
import { isRoleAllowedForPath } from "@/lib/routeAccess";
import { lazyLoad } from "@/lib/lazyLoad";

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
type SubSidebarToggleEdge = "top" | "left" | "right";
type SubSidebarTogglePosition = { edge: SubSidebarToggleEdge; x: number; y: number };

const APPROVAL_BADGE_POLL_MS = 5 * 60 * 1000;
const COMMUNICATION_BADGE_POLL_MS = 5 * 60 * 1000;
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

const CONTEXT_SUBNAV_COLLAPSED_KEY = "snhs-context-subnav-collapsed";
const SUB_SIDEBAR_TOGGLE_POSITION_KEY = "snhs-sub-sidebar-toggle-position";
const SUB_SIDEBAR_TOGGLE_SIZE = 44;
const SUB_SIDEBAR_TOGGLE_SAFE_GAP = 12;
const SUB_SIDEBAR_TOGGLE_DRAG_THRESHOLD = 5;
const SUB_SIDEBAR_TOGGLE_LONG_PRESS_MS = 650;
const MAIN_SIDEBAR_WIDTH = 248;
const SUB_SIDEBAR_WIDTH = 224;
const SUB_SIDEBAR_DRAWER_WIDTH = 280;
const SUB_SIDEBAR_COMPACT_QUERY = "(max-width: 1023px)";
const FallbackIcon = Circle;

const primaryNav: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", module: "dashboard", icon: LayoutDashboard },
  { href: "/admin/students", label: "Students", module: "students", icon: Users, activePrefixes: ["/admin/students", "/admin/admission-form"] },
  { href: "/admin/parents", label: "Parents", module: "students", icon: UserCircle, activePrefixes: ["/admin/parents"] },
  { href: "/admin/teachers", label: "Staff", module: "staff", icon: GraduationCap, activePrefixes: ["/admin/teachers"] },
  { href: "/admin/attendance", label: "Attendance", module: "attendance", icon: ClipboardCheck, activePrefixes: ["/admin/attendance", "/admin/my-attendance"] },
  {
    href: "/admin/finance",
    label: "Fees & Finance",
    module: "fees",
    icon: IndianRupee,
    activePrefixes: ["/admin/finance", "/admin/payments", "/admin/fee-structures", "/admin/fee-concessions", "/admin/fee-reminders", "/admin/fee-reports"]
  },
  { href: "/admin/salary", label: "Salary & Payroll", module: "payroll", icon: Wallet, activePrefixes: ["/admin/salary"] },
  {
    href: "/admin/exams",
    label: "Exams & Marks",
    module: "exams",
    icon: BookOpenCheck,
    activePrefixes: ["/admin/exams", "/admin/calendar", "/admin/holidays", "/admin/promotions"]
  },
  { href: "/admin/notices", label: "Communication", module: "communication", icon: Megaphone, activePrefixes: ["/admin/notices", "/admin/messages", "/admin/notifications"] },
  { href: "/admin/reports", label: "Reports", module: "reports", icon: BarChart3, activePrefixes: ["/admin/reports"] },
  { href: "/admin/settings", label: "Settings", module: "settings", icon: Settings, activePrefixes: ["/admin/settings", "/admin/users", "/admin/approvals", "/admin/branches", "/admin/biometric", "/admin/backup"] }
];

// Parent/student portal nav — shown only for portal roles. Admin roles have the
// "portal" module via their wildcard grant, so these must NOT be merged into
// primaryNav or they leak into the admin sidebar (duplicate Dashboard, etc.).
const portalNav: NavItem[] = [
  { href: "/portal", label: "Dashboard", module: "portal", icon: LayoutDashboard },
  { href: "/portal/fees", label: "Fees", module: "portal", icon: IndianRupee },
  { href: "/portal/exams", label: "Exams", module: "portal", icon: BookOpenCheck },
  { href: "/portal/notices", label: "Notices", module: "portal", icon: Megaphone },
  { href: "/portal/contact", label: "Contact", module: "portal", icon: MessageSquare },
  { href: "/portal/profile", label: "Profile", module: "portal", icon: UserCircle }
];

const secondaryNav: NavItem[] = [
  { href: "/admin/calendar", label: "Timetable", module: "academics", icon: CalendarDays },
  { href: "/admin/transport", label: "Transport", module: "transport", icon: Bus },
  { href: "/admin/transport/bus-finance", label: "Bus Finance / EMI", module: "bus_finance", icon: Wallet },
  { href: "/admin/library", label: "Library", module: "library", icon: Library },
  { href: "/admin/hostel", label: "Hostel", module: "hostel", icon: Hotel },
  { href: "/admin/inventory", label: "Inventory", module: "inventory", icon: Package },
  { href: "/admin/branches", label: "Branches", module: "settings", icon: Building2 },
  { href: "/admin/settings", label: "Settings", module: "settings", icon: Settings }
];

const desktopNavSections: Array<{ label: string; hrefs: string[] }> = [
  {
    label: "Main Navigation",
    hrefs: [
      "/admin/dashboard",
      "/admin/students",
      "/admin/parents",
      "/admin/teachers",
      "/admin/attendance",
      "/admin/finance",
      "/admin/salary",
      "/admin/exams",
      "/admin/notices",
      "/admin/reports",
      "/admin/settings"
    ]
  }
];

const contextSubnavs: ContextSubnav[] = [
  {
    title: "Fees & Finance",
    eyebrow: "Accounts",
    matchPrefixes: ["/admin/finance", "/admin/payments", "/admin/fee-structures", "/admin/fee-concessions", "/admin/fee-reminders", "/admin/fee-reports"],
    items: [
      { href: "/admin/finance", label: "Overview", icon: BarChart3, module: "fees" },
      { href: "/admin/payments", label: "Collect Fee", icon: ReceiptIndianRupee, module: "fees" },
      { href: "/admin/fee-structures", label: "Fee Structures", icon: Layers, module: "fees" },
      { href: "/admin/finance/expenses", label: "Expenses", icon: Wallet, module: "fees" },
      { href: "/admin/finance/income", label: "Income", icon: Banknote, module: "fees" },
      { href: "/admin/finance/dues", label: "Dues", icon: FileStack, module: "fees" },
      { href: "/admin/payments", label: "Receipts", icon: ScrollText, module: "fees", activePrefixes: ["/admin/finance/receipt"] },
      { href: "/admin/finance/invoices", label: "Invoices", icon: FileText, module: "fees" },
      { href: "/admin/fee-reports", label: "Reports", icon: BarChart3, module: "fees" }
    ]
  },
  {
    title: "Communication",
    eyebrow: "Messages",
    matchPrefixes: ["/admin/notices", "/admin/messages", "/admin/notifications"],
    items: [
      { href: "/admin/notices", label: "Notices", icon: Megaphone, module: "communication" },
      { href: "/admin/messages", label: "Parent Messages", icon: MessageSquare, module: "communication" },
      { href: "/admin/notifications", label: "Requests & Logs", icon: Bell, module: "communication" }
    ]
  },
  {
    title: "Settings",
    eyebrow: "System",
    matchPrefixes: ["/admin/settings", "/admin/users", "/admin/approvals", "/admin/branches", "/admin/biometric", "/admin/backup"],
    items: [
      { href: "/admin/settings", label: "School Settings", icon: Settings, module: "settings" },
      { href: "/admin/users", label: "Users & Roles", icon: UserCog, module: "users" },
      { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, module: "settings" },
      { href: "/admin/branches", label: "Branches", icon: Building2, module: "settings" },
      { href: "/admin/biometric", label: "Biometric", icon: CalendarCheck, module: "settings" },
      { href: "/admin/backup", label: "Backup", icon: FileStack, module: "settings" }
    ]
  },
  {
    title: "Exams & Marks",
    eyebrow: "Academics",
    matchPrefixes: ["/admin/exams", "/admin/calendar", "/admin/holidays", "/admin/promotions"],
    items: [
      { href: "/admin/exams", label: "Exams", icon: BookOpenCheck, module: "exams" },
      { href: "/admin/calendar", label: "Timetable", icon: CalendarDays, module: "academics" },
      { href: "/admin/holidays", label: "Holidays", icon: CalendarRange, module: "academics" },
      { href: "/admin/promotions", label: "Promotions", icon: GraduationCap, module: "promotions" }
    ]
  },
  {
    title: "Students",
    eyebrow: "Admissions",
    matchPrefixes: ["/admin/students", "/admin/admission-form"],
    items: [
      { href: "/admin/students", label: "Student List", icon: Users, module: "students" },
      { href: "/admin/admission-form", label: "Admission Form", icon: UserPlus, module: "students" }
    ]
  },
  {
    title: "Attendance",
    eyebrow: "Daily Ops",
    matchPrefixes: ["/admin/attendance", "/admin/my-attendance"],
    items: [
      { href: "/admin/attendance", label: "Records", icon: ClipboardCheck, module: "attendance" },
      { href: "/admin/my-attendance", label: "My Attendance", icon: CalendarCheck, module: "attendance" }
    ]
  }
];

// Curated mobile nav — a focused subset of the app for phones. Items are still
// gated by `module` access where one is given; My Attendance is always shown.
type MobileNavItem = { href: string; label: string; short: string; icon: LucideIcon; module?: Module };
const mobileNav: MobileNavItem[] = [
  // Portal (parent) mobile nav
  { href: "/portal", label: "Dashboard", short: "Home", icon: LayoutDashboard, module: "portal" },
  { href: "/portal/fees", label: "Fees", short: "Fees", icon: IndianRupee, module: "portal" },
  { href: "/portal/exams", label: "Exams", short: "Exams", icon: BookOpenCheck, module: "portal" },
  { href: "/portal/notices", label: "Notices", short: "Notices", icon: Megaphone, module: "portal" },
  // Admin mobile nav
  { href: "/admin/dashboard", label: "Summary", short: "Summary", icon: Grid2X2, module: "dashboard" },
  { href: "/admin/reports", label: "Reports", short: "Reports", icon: BarChart3, module: "reports" },
  { href: "/admin/notices", label: "Notices", short: "Notices", icon: Megaphone, module: "communication" },
  { href: "/admin/my-attendance", label: "My Attendance", short: "Attendance", icon: CalendarCheck, module: "attendance" },
  { href: "/admin/notifications", label: "Notifications & Leave", short: "Alerts", icon: BellRing, module: "communication" }
];

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/my-attendance": "My Attendance",
  "/admin/notices": "Notices",
  "/admin/students": "Students",
  "/admin/parents": "Parents",
  "/admin/teachers": "Teachers",
  "/admin/attendance": "Attendance",
  "/admin/reports": "Attendance Reports",
  "/admin/payments": "Fees & Finance",
  "/admin/fee-structures": "Fee Structures",
  "/admin/fee-reminders": "Fee Reminders",
  "/admin/fee-concessions": "Fee Concessions",
  "/admin/fee-reports": "Fee Reports",
  "/admin/salary": "Salary & Payroll",
  "/admin/notifications": "Communication",
  "/admin/messages": "Parent Messages",
  "/admin/calendar": "Timetable",
  "/admin/holidays": "Holidays",
  "/admin/settings/academic-years": "Academic Years",
  "/admin/promotions": "Promotion",
  "/admin/users": "Users & Roles",
  "/admin/approvals": "Approvals",
  "/portal": "Dashboard",
  "/portal/payments": "Payment History",
  "/portal/payments/receipt": "Receipt",
  "/portal/fees": "Fee Management",
  "/portal/exams": "Examinations",
  "/portal/notices": "Notices & Circulars",
  "/portal/contact": "Contact School",
  "/portal/profile": "Parent Profile",
  "/admin/branches": "Branches",
  "/admin/settings": "Settings",
  "/admin/biometric": "Biometric Devices",
  "/admin/backup": "Backup & Restore"
};

const routeModules: Array<{ prefix: string; module: Module }> = [
  { prefix: "/admin/finance", module: "fees" },
  { prefix: "/admin/fee-concessions", module: "fees" },
  { prefix: "/admin/fee-structures", module: "fees" },
  { prefix: "/admin/fee-reports", module: "fees" },
  { prefix: "/admin/settings/academic-years", module: "academic_years" },
  { prefix: "/admin/teachers", module: "staff" },
  { prefix: "/admin/attendance", module: "attendance" },
  { prefix: "/admin/reports", module: "reports" },
  { prefix: "/admin/payments", module: "fees" },
  { prefix: "/admin/fee-reminders", module: "fees" },
  { prefix: "/admin/salary", module: "payroll" },
  { prefix: "/admin/notifications", module: "communication" },
  { prefix: "/admin/calendar", module: "academics" },
  { prefix: "/admin/holidays", module: "academics" },
  { prefix: "/admin/branches", module: "settings" },
  { prefix: "/admin/settings", module: "settings" },
  { prefix: "/admin/biometric", module: "settings" },
  { prefix: "/admin/backup", module: "settings" },
  { prefix: "/admin/promotions", module: "promotions" },
  { prefix: "/admin/students", module: "students" },
  { prefix: "/admin/parents", module: "students" },
  { prefix: "/admin/messages", module: "communication" },
  { prefix: "/admin/approvals", module: "settings" },
  { prefix: "/admin/users", module: "users" },
  { prefix: "/portal", module: "portal" },
  { prefix: "/admin/dashboard", module: "dashboard" }
];

function moduleForPath(pathname: string): Module | undefined {
  return routeModules.find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`))?.module;
}

function navForRole(items: Array<NavItem | null | undefined>, role?: Role): NavItem[] {
  const allowed = new Set(modulesForRole(role));
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

function clampNumber(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function isSubSidebarCompactViewport() {
  return typeof window !== "undefined" && window.matchMedia(SUB_SIDEBAR_COMPACT_QUERY).matches;
}

function getSubSidebarToggleMetrics() {
  const viewportWidth = Math.max(window.innerWidth, SUB_SIDEBAR_TOGGLE_SIZE + SUB_SIDEBAR_TOGGLE_SAFE_GAP * 2);
  const viewportHeight = Math.max(window.innerHeight, SUB_SIDEBAR_TOGGLE_SIZE + SUB_SIDEBAR_TOGGLE_SAFE_GAP * 2);
  const compact = isSubSidebarCompactViewport();
  const panelLeft = compact && viewportWidth < 768 ? 0 : MAIN_SIDEBAR_WIDTH;
  const panelWidth = compact ? Math.min(SUB_SIDEBAR_DRAWER_WIDTH, Math.floor(viewportWidth * 0.86)) : SUB_SIDEBAR_WIDTH;
  const left = clampNumber(panelLeft, 0, Math.max(0, viewportWidth - SUB_SIDEBAR_TOGGLE_SAFE_GAP - SUB_SIDEBAR_TOGGLE_SIZE));
  const right = clampNumber(left + panelWidth, left + SUB_SIDEBAR_TOGGLE_SIZE, viewportWidth - SUB_SIDEBAR_TOGGLE_SAFE_GAP);

  return {
    compact,
    left,
    right,
    minX: SUB_SIDEBAR_TOGGLE_SAFE_GAP,
    maxX: viewportWidth - SUB_SIDEBAR_TOGGLE_SIZE - SUB_SIDEBAR_TOGGLE_SAFE_GAP,
    minY: SUB_SIDEBAR_TOGGLE_SAFE_GAP,
    maxY: viewportHeight - SUB_SIDEBAR_TOGGLE_SIZE - SUB_SIDEBAR_TOGGLE_SAFE_GAP
  };
}

function getSubSidebarTopSnapBounds(metrics = getSubSidebarToggleMetrics()) {
  const compactStartGap = metrics.compact ? SUB_SIDEBAR_TOGGLE_SIZE + SUB_SIDEBAR_TOGGLE_SAFE_GAP * 2 : SUB_SIDEBAR_TOGGLE_SAFE_GAP;
  const minX = clampNumber(metrics.left + compactStartGap, metrics.minX, metrics.maxX);
  const maxX = clampNumber(metrics.right - SUB_SIDEBAR_TOGGLE_SIZE - SUB_SIDEBAR_TOGGLE_SAFE_GAP, minX, metrics.maxX);
  return { minX, maxX };
}

function getDefaultSubSidebarTogglePosition(): SubSidebarTogglePosition {
  const metrics = getSubSidebarToggleMetrics();
  if (metrics.compact) {
    const topBounds = getSubSidebarTopSnapBounds(metrics);
    return { edge: "top", x: topBounds.maxX, y: metrics.minY };
  }

  return {
    edge: "left",
    x: clampNumber(metrics.left - SUB_SIDEBAR_TOGGLE_SIZE / 2, metrics.minX, metrics.maxX),
    y: clampNumber(92, metrics.minY, metrics.maxY)
  };
}

function clampSubSidebarToggleToViewport(x: number, y: number) {
  const metrics = getSubSidebarToggleMetrics();
  return {
    x: clampNumber(x, metrics.minX, metrics.maxX),
    y: clampNumber(y, metrics.minY, metrics.maxY)
  };
}

function normalizeSubSidebarTogglePosition(position?: SubSidebarTogglePosition | null): SubSidebarTogglePosition {
  const metrics = getSubSidebarToggleMetrics();
  const fallback = getDefaultSubSidebarTogglePosition();
  const edge = metrics.compact ? "top" : position?.edge ?? fallback.edge;

  if (edge === "top") {
    const topBounds = getSubSidebarTopSnapBounds(metrics);
    return {
      edge,
      x: clampNumber(position?.x ?? fallback.x, topBounds.minX, topBounds.maxX),
      y: metrics.minY
    };
  }

  const edgeX = edge === "right" ? metrics.right - SUB_SIDEBAR_TOGGLE_SIZE / 2 : metrics.left - SUB_SIDEBAR_TOGGLE_SIZE / 2;
  return {
    edge,
    x: clampNumber(edgeX, metrics.minX, metrics.maxX),
    y: clampNumber(position?.y ?? fallback.y, metrics.minY, metrics.maxY)
  };
}

function snapSubSidebarTogglePosition(position: SubSidebarTogglePosition): SubSidebarTogglePosition {
  const metrics = getSubSidebarToggleMetrics();
  const clamped = clampSubSidebarToggleToViewport(position.x, position.y);

  if (metrics.compact) {
    return normalizeSubSidebarTogglePosition({ ...position, edge: "top", ...clamped });
  }

  const leftX = metrics.left - SUB_SIDEBAR_TOGGLE_SIZE / 2;
  const rightX = metrics.right - SUB_SIDEBAR_TOGGLE_SIZE / 2;
  const distances: Array<{ edge: SubSidebarToggleEdge; distance: number }> = [
    { edge: "top", distance: Math.abs(clamped.y - metrics.minY) },
    { edge: "left", distance: Math.abs(clamped.x - leftX) },
    { edge: "right", distance: Math.abs(clamped.x - rightX) }
  ];
  distances.sort((a, b) => a.distance - b.distance);

  return normalizeSubSidebarTogglePosition({ ...position, edge: distances[0]?.edge ?? "left", ...clamped });
}

function isSavedSubSidebarToggleEdge(edge: unknown): edge is SubSidebarToggleEdge {
  return edge === "top" || edge === "left" || edge === "right";
}

function readSavedSubSidebarTogglePosition() {
  try {
    const raw = window.localStorage.getItem(SUB_SIDEBAR_TOGGLE_POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SubSidebarTogglePosition>;
    if (!isSavedSubSidebarToggleEdge(parsed.edge) || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null;
    return parsed as SubSidebarTogglePosition;
  } catch {
    return null;
  }
}

function saveSubSidebarTogglePosition(position: SubSidebarTogglePosition) {
  try {
    window.localStorage.setItem(SUB_SIDEBAR_TOGGLE_POSITION_KEY, JSON.stringify(position));
  } catch {
    // Local storage can be blocked; the current session position still works.
  }
}

function resetSavedSubSidebarTogglePosition() {
  try {
    window.localStorage.removeItem(SUB_SIDEBAR_TOGGLE_POSITION_KEY);
  } catch {
    // ignore
  }
}

function NavEntry({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isPathActive(pathname, item.href, item.activePrefixes);
  const childActive = item.children?.some((child) => isPathActive(pathname, child.href)) ?? false;
  const [open, setOpen] = useState(active || childActive);
  const Icon = item.icon ?? FallbackIcon;

  return (
    <div>
      <div className="flex items-stretch">
        <Link
          href={item.href}
          className={clsx(
            "group relative flex flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition duration-200",
            active
              ? "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_8px_18px_rgba(5,8,55,0.18)]"
              : "text-[#d7defb] hover:bg-white/[0.09] hover:text-white"
          )}
        >
          {active && <span className="absolute inset-y-2 -left-2 w-1 rounded-r-full bg-[#f7c948]" />}
          <Icon size={18} strokeWidth={2.35} className={active ? "text-white" : "text-[#bbc6ff] group-hover:text-white"} />
          <span className="flex-1">{item.label}</span>
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
  onToggle
}: {
  title: string;
  collapsed: boolean;
  drawerOpen: boolean;
  onToggle: () => void;
}) {
  const [position, setPosition] = useState<SubSidebarTogglePosition | null>(null);
  const [compactViewport, setCompactViewport] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [snapAnimating, setSnapAnimating] = useState(false);
  const positionRef = useRef<SubSidebarTogglePosition | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originEdge: SubSidebarToggleEdge;
    dragging: boolean;
  } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);
  const longPressTriggeredRef = useRef(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const clearLongPressTimer = useCallback(() => {
    if (!longPressTimerRef.current) return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }, []);

  const animateSnap = useCallback(() => {
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    setSnapAnimating(true);
    snapTimerRef.current = setTimeout(() => {
      setSnapAnimating(false);
      snapTimerRef.current = null;
    }, 240);
  }, []);

  const restorePosition = useCallback(() => {
    const next = normalizeSubSidebarTogglePosition(readSavedSubSidebarTogglePosition());
    positionRef.current = next;
    setCompactViewport(isSubSidebarCompactViewport());
    setPosition(next);
  }, []);

  const resetPosition = useCallback(() => {
    clearLongPressTimer();
    resetSavedSubSidebarTogglePosition();
    const next = getDefaultSubSidebarTogglePosition();
    positionRef.current = next;
    dragRef.current = null;
    setDragging(false);
    setPosition(next);
    animateSnap();
  }, [animateSnap, clearLongPressTimer]);

  useEffect(() => {
    restorePosition();

    const handleViewportChange = () => restorePosition();
    window.addEventListener("resize", handleViewportChange);
    const compactMedia = window.matchMedia(SUB_SIDEBAR_COMPACT_QUERY);
    compactMedia.addEventListener("change", handleViewportChange);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      compactMedia.removeEventListener("change", handleViewportChange);
    };
  }, [restorePosition]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    };
  }, [clearLongPressTimer]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !positionRef.current) return;
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    setSnapAnimating(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    const currentPosition = positionRef.current;
    longPressTriggeredRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: currentPosition.x,
      originY: currentPosition.y,
      originEdge: currentPosition.edge,
      dragging: false
    };
    setDragging(false);
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      suppressClickRef.current = true;
      resetPosition();
    }, SUB_SIDEBAR_TOGGLE_LONG_PRESS_MS);
  }, [clearLongPressTimer, resetPosition]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.dragging && Math.hypot(deltaX, deltaY) >= SUB_SIDEBAR_TOGGLE_DRAG_THRESHOLD) {
      dragState.dragging = true;
      setDragging(true);
      clearLongPressTimer();
    }

    if (!dragState.dragging) return;
    event.preventDefault();
    const nextPoint = clampSubSidebarToggleToViewport(dragState.originX + deltaX, dragState.originY + deltaY);
    const nextPosition = { edge: dragState.originEdge, ...nextPoint };
    positionRef.current = nextPosition;
    setPosition(nextPosition);
  }, [clearLongPressTimer]);

  const suppressNextClickBriefly = useCallback(() => {
    suppressClickRef.current = true;
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 350);
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      clearLongPressTimer();
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      suppressNextClickBriefly();
      return;
    }

    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    clearLongPressTimer();
    dragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    if (!dragState.dragging) {
      setDragging(false);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const nextPoint = clampSubSidebarToggleToViewport(
      dragState.originX + event.clientX - dragState.startX,
      dragState.originY + event.clientY - dragState.startY
    );
    const snappedPosition = snapSubSidebarTogglePosition({ edge: dragState.originEdge, ...nextPoint });
    positionRef.current = snappedPosition;
    setDragging(false);
    setPosition(snappedPosition);
    saveSubSidebarTogglePosition(snappedPosition);
    animateSnap();
    suppressNextClickBriefly();
  }, [animateSnap, clearLongPressTimer, suppressNextClickBriefly]);

  const handlePointerCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      clearLongPressTimer();
      suppressNextClickBriefly();
      return;
    }

    const dragState = dragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    clearLongPressTimer();
    dragRef.current = null;
    setDragging(false);
    if (!dragState.dragging || !positionRef.current) return;

    const snappedPosition = snapSubSidebarTogglePosition(positionRef.current);
    positionRef.current = snappedPosition;
    setPosition(snappedPosition);
    saveSubSidebarTogglePosition(snappedPosition);
    animateSnap();
    suppressNextClickBriefly();
  }, [animateSnap, clearLongPressTimer, suppressNextClickBriefly]);

  const handleClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      return;
    }

    onToggle();
  }, [onToggle]);

  const handleContextMenu = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    suppressNextClickBriefly();
    resetPosition();
  }, [resetPosition, suppressNextClickBriefly]);

  if (!position) return null;

  const expanded = compactViewport ? drawerOpen : !collapsed;
  const ToggleIcon = expanded ? ChevronLeft : Menu;
  const actionLabel = expanded ? `Hide ${title} navigation` : `Show ${title} navigation`;
  const style: CSSProperties = {
    transform: `translate3d(${position.x}px, ${position.y}px, 0)`
  };

  return (
    <button
      type="button"
      aria-label={actionLabel}
      aria-expanded={expanded}
      title={`${actionLabel}. Drag to move. Long press or right-click to reset.`}
      data-sub-sidebar-toggle-button
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onContextMenu={handleContextMenu}
      style={style}
      className={clsx(
        "fixed left-0 top-0 z-[60] grid h-11 w-11 touch-none select-none place-items-center rounded-lg border border-border bg-card/95 text-primary shadow-lg outline-none backdrop-blur transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:bg-accent focus:ring-2 focus:ring-ring/30 print:hidden",
        position.edge === "top" && "rounded-t-none",
        position.edge === "left" && "rounded-l-none",
        position.edge === "right" && "rounded-r-none",
        dragging ? "cursor-grabbing shadow-2xl ring-2 ring-primary/25 transition-none" : "cursor-grab",
        snapAnimating && "will-change-transform"
      )}
    >
      <ToggleIcon size={20} strokeWidth={2.55} />
      <span className="sr-only">{actionLabel}</span>
    </button>
  );
}

function ContextualSubnav({
  subnav,
  pathname,
  collapsed,
  drawerOpen,
  onCloseDrawer
}: {
  subnav: ContextSubnav;
  pathname: string;
  collapsed: boolean;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const items = (subnav.items ?? []).filter((item): item is ContextSubnavItem => Boolean(item?.href && item.label));

  const renderLinks = (onNavigate?: () => void, interactive = true) => (
    <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {items.map(({ href, label, icon, activePrefixes }) => {
        const active = isPathActive(pathname, href, activePrefixes);
        const Icon = icon ?? FallbackIcon;
        return (
          <Link
            key={`${href}-${label}`}
            href={href}
            onClick={onNavigate}
            tabIndex={interactive ? undefined : -1}
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
    <div className="border-b border-border px-5 py-5">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">{subnav.eyebrow}</p>
        <h2 className="mt-1 truncate text-lg font-extrabold tracking-tight text-foreground">{subnav.title}</h2>
      </div>
    </div>
  );

  return (
    <>
      <aside
        aria-hidden={collapsed}
        className={clsx(
          "fixed inset-y-0 left-[248px] z-40 hidden w-[224px] flex-col border-r border-border bg-card shadow-xl transition-[transform,opacity] duration-300 ease-out lg:flex print:hidden",
          collapsed ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100"
        )}
      >
        {header()}
        {renderLinks(undefined, !collapsed)}
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
          "fixed inset-y-0 left-0 z-40 flex w-[280px] max-w-[86vw] flex-col border-r border-border bg-card shadow-2xl transition-transform duration-300 ease-out md:left-[248px] lg:hidden print:hidden",
          drawerOpen ? "translate-x-0" : "pointer-events-none -translate-x-full md:-translate-x-[calc(100%+248px)]"
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

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
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

// Read-only badge: the academic year is chosen at login (per-login scope), so
// the top bar only DISPLAYS the selection — global switching was removed.
function AcademicYearBadge() {
  const { selectedYear, loading } = useAcademicYears();

  return (
    <div className="hidden min-w-[172px] items-center gap-2.5 rounded-lg border border-border bg-input px-3.5 py-2.5 md:flex" title="Academic year (selected at login)">
      <CalendarRange size={17} className="shrink-0 text-[#8490b9]" />
      <span className="truncate text-sm font-bold text-foreground">
        {selectedYear?.name ?? (loading ? "Loading..." : "No academic year")}
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
          <h2 className="text-lg font-extrabold text-foreground">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            Your role does not have permission to open {module ? module.replace("_", " ") : "this page"}.
          </p>
        </div>
      </div>
    </section>
  );
}

type Profile = { uid: string; name: string; email?: string; role?: Role };

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
  const [signingOut, setSigningOut] = useState(false);
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
        const claims = await refreshClaims(user);
        const claimRole = claims?.role;
        if (isValidRole(claimRole)) role = claimRole;
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          const data = snapshot.data() as { displayName?: string; role?: unknown };
          if (data.displayName) name = data.displayName;
          if (isValidRole(data.role)) role = data.role;
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

  // Pending approval count badge
  const [pendingApprovals, setPendingApprovals] = useState(0);
  useEffect(() => {
    if (!isFirebaseConfigured || !role || !canAccessModule(role, "settings") || !isRoleAllowedForPath("/admin/approvals", role)) {
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
      if (stopped) return;
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
        setPendingApprovals(data?.ok && Number.isFinite(count) ? count : 0);
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
  }, [role]);

  const [pendingCommunicationRequests, setPendingCommunicationRequests] = useState(0);
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
      (role !== "admin" && role !== "super_admin") ||
      !canAccessModule(role, "communication") ||
      !isRoleAllowedForPath("/admin/notifications", role)
    ) {
      setPendingCommunicationRequests(0);
      return;
    }

    let stopped = false;
    let interval: ReturnType<typeof setInterval> | undefined;
    const fetchCount = async () => {
      if (stopped) return;
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
        setPendingCommunicationRequests(data?.ok && Number.isFinite(count) ? count : 0);
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
  }, [role, pathname]);

  // Mobile slide-in nav drawer. Closes automatically on navigation.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => setMobileNavOpen(false), [pathname]);

  const [contextSubnavCollapsed, setContextSubnavCollapsed] = useState(false);
  const [contextSubnavPreferenceLoaded, setContextSubnavPreferenceLoaded] = useState(false);
  const [contextSubnavDrawerOpen, setContextSubnavDrawerOpen] = useState(false);
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

  // The accountant has no use for the admin dashboard — send them straight to
  // Finance as their home so they don't land on (or see the URL of) /admin/dashboard.
  useEffect(() => {
    if (!sessionLoading && role === "accountant" && pathname === "/admin/dashboard") {
      router.replace("/admin/finance");
    }
  }, [sessionLoading, role, pathname, router]);

  const sessionValue = useMemo(() => ({ profile, role, loading: sessionLoading || signingOut }), [profile, role, sessionLoading, signingOut]);
  const isPortalRole = role === "parent" || role === "student";
  const mainNav = useMemo(
    () => navForRole(
      (isPortalRole ? portalNav : primaryNav).map((item) => item.href === "/admin/approvals" ? { ...item, badge: pendingApprovals } : item),
      role
    ),
    [role, isPortalRole, pendingApprovals]
  );
  const generalNav = useMemo(() => (isPortalRole ? [] : navForRole(secondaryNav, role)), [role, isPortalRole]);
  const contextualSubnav = useMemo(() => {
    if (isPortalRole) return null;
    const section = contextSubnavs.find((candidate) =>
      candidate.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    );
    if (!section) return null;

    const allowedItems = section.items.filter((item) => {
      if (item.module && (!role || !canAccessModule(role, item.module))) return false;
      return isRoleAllowedForPath(item.href, role);
    });

    return allowedItems.length > 0 ? { ...section, items: allowedItems } : null;
  }, [pathname, role, isPortalRole]);
  useEffect(() => {
    if (!contextualSubnav) setContextSubnavDrawerOpen(false);
  }, [contextualSubnav]);
  const desktopNavGroups = useMemo(() => {
    if (isPortalRole) return mainNav.length ? [{ label: "Portal", items: mainNav }] : [];
    const itemMap = new Map([...mainNav, ...generalNav].map((item) => [item.href, item]));
    return desktopNavSections
      .map((section) => ({
        label: section.label,
        items: section.hrefs.map((href) => itemMap.get(href)).filter((item): item is NavItem => Boolean(item))
      }))
      .filter((section) => section.items.length > 0);
  }, [mainNav, generalNav, isPortalRole]);
  const bottomTabs = useMemo(
    () => mobileNav.filter((item) => {
      if (!item?.href || !item.label || !item.short) return false;
      if (!item.module) return true;
      if (!role || !canAccessModule(role, item.module)) return false;
      // Keep portal tabs for portal roles and admin tabs for everyone else, so
      // the wildcard "portal" grant doesn't surface parent tabs for admins.
      return isPortalRole ? item.href.startsWith("/portal") : !item.href.startsWith("/portal");
    }),
    [role, isPortalRole]
  );
  const currentModule = moduleForPath(pathname);
  // Denied if EITHER the module RBAC matrix OR the central route table blocks the
  // current path. The route table covers the sensitive sub-areas (finance,
  // settings, users, roles) that the coarse module check alone would let through.
  const routeDenied =
    !sessionLoading &&
    !signingOut &&
    ((Boolean(currentModule) && (!role || !canAccessModule(role, currentModule!))) ||
      !isRoleAllowedForPath(pathname, role));
  const roleLabel = role ? ROLE_LABELS[role] : "Loading...";
  const notificationLabel =
    pendingCommunicationRequests > 0
      ? `Communication & notifications, ${pendingCommunicationRequests} pending`
      : "Communication & notifications";

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
    setSigningOut(true);
    clearPayrollSessionId();
    // Wipe cached API responses so the next account on this device
    // can't see this user's data.
    clearAdminApiCacheForSignOut();
    try {
      window.sessionStorage.removeItem("erp-auth-role");
    } catch {
      // ignore
    }
    try {
      // The academic year is a per-login choice; clear it so the next login
      // starts from the default (active) year.
      window.localStorage.removeItem("sriNarayana.selectedAcademicYear");
    } catch {
      // ignore
    }
    if (!isFirebaseConfigured) {
      router.replace("/login");
      return;
    }
    try {
      await signOut(auth);
    } finally {
      router.replace("/login");
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
          "fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[85vw] flex-col overflow-hidden bg-[linear-gradient(180deg,#17217f_0%,#11195f_100%)] text-white shadow-2xl transition-transform duration-300 ease-out md:w-[248px] md:max-w-none md:shadow-[12px_0_28px_rgba(18,27,105,0.12)] md:translate-x-0 print:hidden",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
          <div className="theme-preserve-light grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white p-1 shadow-lg shadow-black/10">
            <img src="/sri-narayana-high-school-logo.jpg" alt="Sri Narayana High School" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-base font-bold leading-5 text-white">Sri Narayana</p>
            <p className="mt-0.5 text-[10px] font-bold tracking-[0.08em] text-[#b7c3ff]">HIGH SCHOOL · ERP</p>
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

        {/* Mobile: curated essentials only */}
        <nav className="nav-scroll min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-5 md:hidden">
          {bottomTabs.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon ?? FallbackIcon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "group relative flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition duration-200",
                  active ? "bg-white/[0.14] text-white shadow-[0_8px_20px_rgba(8,10,92,0.18)]" : "text-[#dce2ff] hover:bg-white/10 hover:text-white"
                )}
              >
                {active && <span className="absolute inset-y-3 -left-2 w-1 rounded-r-full bg-[#ffd23f]" />}
                <Icon size={20} strokeWidth={2.4} className={active ? "text-white" : "text-[#c5ceff] group-hover:text-white"} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop: full navigation */}
        <nav className="nav-scroll hidden min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4 md:block">
          {desktopNavGroups.map((section) => (
            <div key={section.label} className="space-y-1">
              <p className="px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8fa0ed]">{section.label}</p>
              {section.items.map((item) => (
                <NavEntry key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          ))}

          {role && canAccessModule(role, "attendance") && (
            <div className="space-y-1 pt-1">
              <p className="px-2 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.13em] text-[#8fa0ed]">Me</p>
              <Link
                href="/admin/my-attendance"
                className={clsx(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition duration-200",
                  pathname === "/admin/my-attendance"
                    ? "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_8px_18px_rgba(5,8,55,0.18)]"
                    : "text-[#d7defb] hover:bg-white/[0.09] hover:text-white"
                )}
              >
                {pathname === "/admin/my-attendance" && <span className="absolute inset-y-2 -left-2 w-1 rounded-r-full bg-[#ffd23f]" />}
                <CalendarCheck size={18} strokeWidth={2.35} className={pathname === "/admin/my-attendance" ? "text-white" : "text-[#c5ceff] group-hover:text-white"} />
                My Attendance
              </Link>
            </div>
          )}
        </nav>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="mt-auto flex items-center gap-3 border-t border-white/10 px-4 py-4 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-70"
          title={signingOut ? "Signing out" : "Sign out"}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-[#ffc73d] text-xs font-extrabold text-[#2a2c87]">
            {profile ? initialsOf(profile.name) : "··"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold">{profile?.name ?? "User"}</span>
            <span className="block text-xs text-[#aeb9f2]">{roleLabel}</span>
          </span>
          <LogOut size={19} className="text-[#bdc8ff]" />
        </button>
      </aside>

      {contextualSubnav && (
        <ContextualSubnav
          subnav={contextualSubnav}
          pathname={pathname}
          collapsed={contextSubnavCollapsed}
          drawerOpen={contextSubnavDrawerOpen}
          onCloseDrawer={() => setContextSubnavDrawerOpen(false)}
        />
      )}

      {contextualSubnav && !mobileNavOpen && (
        <SubSidebarToggleButton
          title={contextualSubnav.title}
          collapsed={contextSubnavCollapsed}
          drawerOpen={contextSubnavDrawerOpen}
          onToggle={toggleSubSidebar}
        />
      )}

      <main
        key={pathname}
        className={clsx(
          "flex min-w-0 flex-1 flex-col transition-[margin] duration-300 ease-out print:ml-0 print:block",
          contextualSubnav && !contextSubnavCollapsed ? "md:ml-[248px] lg:ml-[472px]" : "md:ml-[248px]"
        )}
      >
        <header className="sticky top-0 z-20 flex min-h-[64px] shrink-0 items-center gap-3 border-b border-border bg-card/90 px-3 py-2.5 shadow-sm backdrop-blur md:min-h-[72px] md:gap-4 md:px-6 md:py-3 print:hidden">
          <button
            type="button"
            onClick={() => {
              setContextSubnavDrawerOpen(false);
              setMobileNavOpen(true);
            }}
            aria-label="Open menu"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground transition hover:bg-muted md:hidden"
          >
            <Menu size={20} />
          </button>
          <div className="min-w-0 flex-1 md:min-w-[170px]">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-foreground md:text-xl">{title}</h1>
            <p className="truncate text-xs font-medium text-muted-foreground"><HeaderDateLabel now={now} /></p>
          </div>
          <AcademicYearBadge />
          <LiveClock className="hidden sm:inline-flex" />
          <DarkModeToggle />
          {role && canAccessModule(role, "communication") && (
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
            className="ml-1 grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60 md:h-11 md:w-11"
          >
            <RefreshCw size={19} className={clsx(refreshing && "animate-spin")} />
          </button>
        </header>
        <div key={pathname} className="page-enter flex-1 overflow-y-auto pb-[76px] md:pb-0 print:overflow-visible print:pb-0 print:opacity-100">
          <ErrorBoundary resetKey={pathname}>
            {sessionLoading || signingOut ? <BrandLoader message={signingOut ? "Signing out…" : "Loading secure workspace…"} /> : routeDenied ? <AccessDeniedState module={currentModule} /> : (<>{!contextualSubnav && <SectionTabs />}{children}</>)}
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
            </footer>
          )}
        </div>
      </main>

      {/* Mobile bottom tab bar — quick access to the essentials */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden">
        {bottomTabs.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon ?? FallbackIcon;
          return (
            <Link
              key={item.href}
              href={item.href}
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
      </AcademicYearProvider>
    </AdminSessionProvider>
  );
}
