import {
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  Brain,
  Building2,
  Bus,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileStack,
  FileText,
  Fuel,
  Gauge,
  GraduationCap,
  Hotel,
  IdCard,
  IndianRupee,
  Layers,
  LayoutDashboard,
  Library,
  MapPin,
  Megaphone,
  MessageSquare,
  NotebookPen,
  Package,
  ReceiptIndianRupee,
  RefreshCw,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  User,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  Wallet,
  Wrench
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Module } from "@sri-narayana/shared";

export type NavigationItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  module?: Module;
  activePrefixes?: string[];
};

export type NavigationGroup = {
  id: string;
  label: string;
  eyebrow: string;
  href: string;
  module: Module;
  icon: LucideIcon;
  activePrefixes: string[];
  matchPrefixes: string[];
  items: NavigationItem[];
  searchItems?: NavigationItem[];
};

const masterNavItems: NavigationItem[] = [
  { href: "/admin/masters/exam-types", label: "Exam Types", icon: BookOpenCheck, module: "exams" },
  { href: "/admin/masters/grades", label: "Grade Scales", icon: GraduationCap, module: "exams" },
  { href: "/admin/masters/cocurricular-areas", label: "Cocurricular Areas", icon: BookOpen, module: "exams" },
  { href: "/admin/masters/assessment-types", label: "Assessment Types", icon: BarChart3, module: "exams" },
  { href: "/admin/masters/departments", label: "Departments", icon: Building2, module: "staff" },
  { href: "/admin/masters/designations", label: "Designations", icon: UserCog, module: "staff" },
  { href: "/admin/masters/leave-types", label: "Leave Types", icon: CalendarDays, module: "staff" },
  { href: "/admin/masters/salary-templates", label: "Salary Templates", icon: Wallet, module: "payroll" },
  { href: "/admin/masters/appraisal-criteria", label: "Appraisal Criteria", icon: Gauge, module: "payroll" },
  { href: "/admin/masters/fee-types", label: "Fee Types", icon: IndianRupee, module: "fees" },
  { href: "/admin/masters/fee-groups", label: "Fee Groups", icon: Layers, module: "fees" },
  { href: "/admin/masters/income-heads", label: "Income Heads", icon: ReceiptIndianRupee, module: "fees" },
  { href: "/admin/masters/expense-heads", label: "Expense Heads", icon: Wallet, module: "fees" },
  { href: "/admin/masters/bank-accounts", label: "Bank Accounts", icon: Building2, module: "fees" },
  { href: "/admin/masters/student-houses", label: "Student Houses", icon: Users, module: "students" },
  { href: "/admin/masters/student-categories", label: "Student Categories", icon: UserCircle, module: "students" },
  { href: "/admin/masters/buildings", label: "Buildings & Blocks", icon: Building2, module: "academics" },
  { href: "/admin/masters/id-card-designs", label: "ID Card Designs", icon: FileText, module: "students" },
  { href: "/admin/masters/compliance-packs", label: "Compliance Packs", icon: ShieldCheck, module: "settings" },
  { href: "/admin/masters/survey-templates", label: "Survey Templates", icon: MessageSquare, module: "communication" },
  { href: "/admin/masters/staff-loans", label: "Staff Loans", icon: Wallet, module: "payroll" },
  { href: "/admin/masters/appraisals", label: "Staff Appraisals", icon: ClipboardCheck, module: "payroll" },
  { href: "/admin/masters/classrooms", label: "Classrooms", icon: Building2, module: "academics" },
  { href: "/admin/masters/compliance-items", label: "Compliance Checklist", icon: ShieldCheck, module: "settings" },
  { href: "/admin/masters/surveys", label: "Surveys", icon: MessageSquare, module: "communication" },
  { href: "/admin/masters/assessments", label: "Assessments", icon: BookOpenCheck, module: "exams" },
  { href: "/admin/masters/gallery-albums", label: "Photo Gallery", icon: Megaphone, module: "communication" },
  { href: "/admin/masters/qr-sessions", label: "QR Sessions", icon: ClipboardCheck, module: "attendance" },
  { href: "/admin/masters/ptm-meetings", label: "PTM Meetings", icon: CalendarDays, module: "communication" },
  { href: "/admin/masters/ptm-records", label: "PTM Notes", icon: FileText, module: "communication" },
  { href: "/admin/masters/lesson-plans", label: "Lesson Plans", icon: NotebookPen, module: "academics" },
  { href: "/admin/masters/exam-schedules", label: "Exam Datesheet", icon: CalendarDays, module: "exams" },
  { href: "/admin/masters/exam-remarks", label: "Exam Remarks", icon: FileText, module: "exams" },
  { href: "/admin/masters/custom-fields", label: "Custom Fields", icon: Settings, module: "settings" },
  { href: "/admin/masters/module-toggles", label: "Module Settings", icon: Settings, module: "settings" },
  { href: "/admin/masters/payment-gateways", label: "Payment Gateways", icon: IndianRupee, module: "settings" },
  { href: "/admin/masters/subscription-plans", label: "Subscription Plans", icon: ReceiptIndianRupee, module: "settings" }
];

const adminSettingsItems: NavigationItem[] = [
  { href: "/admin/settings", label: "Settings Manager", icon: Settings, module: "settings" },
  { href: "/admin/settings/activity-logs", label: "Activity Log", icon: ScrollText, module: "settings" },
  { href: "/admin/users", label: "Users & Roles", icon: UserCog, module: "users" },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, module: "settings" },
  { href: "/admin/masters/exam-types", label: "Setup & Masters", icon: Layers, module: "exams" },
  { href: "/admin/biometric", label: "Biometric", icon: CalendarCheck, module: "settings" },
  { href: "/admin/backup", label: "Backup", icon: FileStack, module: "settings" }
];

export const adminNavigationGroups: NavigationGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    eyebrow: "Overview",
    href: "/admin/dashboard",
    module: "dashboard",
    icon: LayoutDashboard,
    activePrefixes: ["/admin/dashboard"],
    matchPrefixes: [],
    items: [{ href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, module: "dashboard" }]
  },
  {
    id: "daily-ops",
    label: "Daily Ops",
    eyebrow: "Today",
    href: "/admin/attendance",
    module: "attendance",
    icon: ClipboardCheck,
    activePrefixes: [
      "/admin/attendance",
      "/admin/my-attendance",
      "/admin/student-attendance",
      "/admin/transport",
      "/admin/notices",
      "/admin/messages",
      "/admin/communications",
      "/admin/notifications"
    ],
    matchPrefixes: [
      "/admin/attendance",
      "/admin/my-attendance",
      "/admin/student-attendance",
      "/admin/transport",
      "/admin/notices",
      "/admin/messages",
      "/admin/communications",
      "/admin/notifications"
    ],
    items: [
      { href: "/admin/attendance", label: "Staff Attendance", icon: ClipboardCheck, module: "attendance" },
      { href: "/admin/my-attendance", label: "My Attendance", icon: CalendarCheck, module: "attendance" },
      { href: "/admin/student-attendance", label: "Student Attendance", icon: ClipboardCheck, module: "students" },
      { href: "/admin/transport", label: "Transport", icon: Bus, module: "transport" },
      { href: "/admin/transport/trips", label: "Driver Trips", icon: MapPin, module: "transport" },
      { href: "/admin/transport/drivers", label: "Drivers", icon: User, module: "transport" },
      { href: "/admin/transport/fuel-logs", label: "Fuel Logs", icon: Fuel, module: "transport" },
      { href: "/admin/transport/daily-km", label: "Daily KM", icon: Gauge, module: "transport" },
      { href: "/admin/transport/maintenance", label: "Maintenance", icon: Wrench, module: "transport" },
      { href: "/admin/transport/insurance", label: "Insurance", icon: ShieldCheck, module: "transport" },
      { href: "/admin/transport/bus-finance", label: "Bus Finance / EMI", icon: Wallet, module: "bus_finance" },
      { href: "/admin/notices", label: "Notices", icon: Megaphone, module: "communication" },
      { href: "/admin/messages", label: "Parent Messages", icon: MessageSquare, module: "communication" },
      { href: "/admin/communications", label: "SMS & WhatsApp", icon: Smartphone, module: "communication" },
      { href: "/admin/notifications", label: "Requests & Logs", icon: Bell, module: "communication" }
    ]
  },
  {
    id: "students",
    label: "Students",
    eyebrow: "Admissions",
    href: "/admin/students",
    module: "students",
    icon: Users,
    activePrefixes: ["/admin/students", "/admin/student-records", "/admin/parents"],
    matchPrefixes: ["/admin/students", "/admin/student-records", "/admin/parents"],
    items: [
      { href: "/admin/students", label: "All Classes", icon: Users, module: "students" },
      { href: "/admin/students/class-1?admission=1", label: "Admission Form", icon: UserPlus, module: "students" },
      { href: "/admin/student-records", label: "Behavior / Health / TC", icon: ShieldAlert, module: "students" },
      { href: "/admin/parents", label: "Parents", icon: UserCircle, module: "parents" }
    ]
  },
  {
    id: "academics",
    label: "Academics",
    eyebrow: "Learning",
    href: "/admin/academics",
    module: "academics",
    icon: BookOpen,
    activePrefixes: [
      "/admin/academics",
      "/admin/exams",
      "/admin/online-exams",
      "/admin/calendar",
      "/admin/holidays",
      "/admin/promotions",
      "/admin/homework",
      "/admin/timetable"
    ],
    matchPrefixes: [
      "/admin/academics",
      "/admin/exams",
      "/admin/online-exams",
      "/admin/calendar",
      "/admin/holidays",
      "/admin/promotions",
      "/admin/homework",
      "/admin/timetable"
    ],
    items: [
      { href: "/admin/academics", label: "Academics", icon: BookOpen, module: "academics" },
      { href: "/admin/academics/assignments", label: "Subject Assignments", icon: Users, module: "academics" },
      { href: "/admin/exams", label: "Exams", icon: BookOpenCheck, module: "exams" },
      { href: "/admin/online-exams", label: "Online Exams", icon: FileText, module: "exams" },
      { href: "/admin/homework", label: "Homework", icon: BookOpen, module: "exams" },
      { href: "/admin/timetable", label: "Timetable", icon: CalendarDays, module: "academics" },
      { href: "/admin/calendar", label: "Attendance Calendar", icon: CalendarRange, module: "academics" },
      { href: "/admin/holidays", label: "Holidays", icon: CalendarDays, module: "academics" },
      { href: "/admin/promotions", label: "Promotions", icon: GraduationCap, module: "promotions" }
    ]
  },
  {
    id: "finance",
    label: "Finance",
    eyebrow: "Accounts",
    href: "/admin/finance",
    module: "fees",
    icon: IndianRupee,
    activePrefixes: [
      "/admin/finance",
      "/admin/payments",
      "/admin/fee-structures",
      "/admin/fee-concessions",
      "/admin/fee-reminders",
      "/admin/fee-fine-rules",
      "/admin/fee-challans",
      "/admin/salary"
    ],
    matchPrefixes: [
      "/admin/finance",
      "/admin/payments",
      "/admin/fee-structures",
      "/admin/fee-concessions",
      "/admin/fee-reminders",
      "/admin/fee-fine-rules",
      "/admin/fee-challans",
      "/admin/salary"
    ],
    items: [
      { href: "/admin/finance", label: "Overview", icon: BarChart3, module: "fees" },
      { href: "/admin/payments", label: "Collect Fee", icon: ReceiptIndianRupee, module: "fees" },
      { href: "/admin/fee-structures", label: "Fee Structures", icon: Layers, module: "fees" },
      { href: "/admin/fee-fine-rules", label: "Fine Rules", icon: ShieldAlert, module: "fees" },
      { href: "/admin/fee-challans", label: "Challans", icon: ReceiptIndianRupee, module: "fees" },
      { href: "/admin/fee-concessions", label: "Concessions", icon: ShieldCheck, module: "fees" },
      { href: "/admin/fee-reminders", label: "Fee Reminders", icon: Bell, module: "fee_reminders" },
      { href: "/admin/finance/carry-forward", label: "Carry Forward", icon: RefreshCw, module: "fees" },
      { href: "/admin/finance/expenses", label: "Expenses", icon: Wallet, module: "fees" },
      { href: "/admin/finance/dues", label: "Dues & Due Slips", icon: FileStack, module: "fees" },
      { href: "/admin/finance/invoices", label: "Invoices", icon: FileText, module: "fees" },
      { href: "/admin/salary", label: "Salary & Payroll", icon: Wallet, module: "payroll" }
    ]
  },
  {
    id: "people",
    label: "People",
    eyebrow: "Staff",
    href: "/admin/teachers",
    module: "staff",
    icon: UserCog,
    activePrefixes: ["/admin/teachers"],
    matchPrefixes: ["/admin/teachers"],
    items: [
      { href: "/admin/teachers", label: "Staff Directory", icon: GraduationCap, module: "staff" },
      { href: "/admin/attendance", label: "Staff Attendance", icon: ClipboardCheck, module: "attendance" },
      { href: "/admin/my-attendance", label: "My Attendance", icon: CalendarCheck, module: "attendance" },
      { href: "/admin/notifications", label: "Leave & Requests", icon: Bell, module: "communication" }
    ]
  },
  {
    id: "resources",
    label: "Resources",
    eyebrow: "Operations",
    href: "/admin/library",
    module: "library",
    icon: Package,
    activePrefixes: ["/admin/library", "/admin/hostel", "/admin/inventory", "/admin/certificates", "/admin/id-cards"],
    matchPrefixes: ["/admin/library", "/admin/hostel", "/admin/inventory", "/admin/certificates", "/admin/id-cards"],
    items: [
      { href: "/admin/library", label: "Library", icon: Library, module: "library" },
      { href: "/admin/hostel", label: "Hostel", icon: Hotel, module: "hostel" },
      { href: "/admin/inventory", label: "Inventory", icon: Package, module: "inventory" },
      { href: "/admin/certificates", label: "Certificates", icon: FileText, module: "certificates" },
      { href: "/admin/id-cards", label: "ID Cards", icon: IdCard, module: "students" }
    ]
  },
  {
    id: "insights",
    label: "Insights",
    eyebrow: "Analysis",
    href: "/admin/reports",
    module: "reports",
    icon: BarChart3,
    activePrefixes: ["/admin/reports", "/admin/ai-agent"],
    matchPrefixes: ["/admin/reports", "/admin/ai-agent"],
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3, module: "reports" },
      { href: "/admin/ai-agent", label: "AI Agent", icon: Brain, module: "ai_agent" },
      { href: "/admin/ai-agent/settings", label: "AI Settings", icon: Settings, module: "ai_agent" },
      { href: "/admin/ai-agent/logs", label: "AI Logs", icon: FileText, module: "ai_agent" },
      { href: "/admin/ai-agent/quota", label: "Quota & Usage", icon: BarChart3, module: "ai_agent" }
    ]
  },
  {
    id: "admin",
    label: "Admin",
    eyebrow: "System",
    href: "/admin/settings",
    module: "settings",
    icon: Settings,
    activePrefixes: [
      "/admin/settings",
      "/admin/users",
      "/admin/approvals",
      "/admin/biometric",
      "/admin/backup",
      "/admin/masters"
    ],
    matchPrefixes: [
      "/admin/settings",
      "/admin/users",
      "/admin/approvals",
      "/admin/biometric",
      "/admin/backup",
      "/admin/masters"
    ],
    items: adminSettingsItems,
    searchItems: [...adminSettingsItems, ...masterNavItems]
  }
];
