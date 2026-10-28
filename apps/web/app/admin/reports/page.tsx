"use client";

import { DatePicker } from "@/components/DatePicker";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { ExportButtons } from "@/components/ExportButtons";
import { PageHeader } from "@/components/PageHeader";
import { ReportTable } from "@/components/reports/ReportTable";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { CLASS_LABELS, CLASS_OPTIONS, SECTION_OPTIONS } from "@/lib/studentClasses";
import { useClassSections } from "@/lib/useClassSections";
import { auth } from "@sri-narayana/shared/firebase/client";
import { hasPermission } from "@sri-narayana/shared";
import type { AcademicYear, AttendanceRecord, SalaryReport, Teacher } from "@sri-narayana/shared";
import { buildDailyAttendanceRows, buildSalaryRows } from "@sri-narayana/shared/services/reports";
import {
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bell,
  BookOpen,
  Bus,
  CalendarCheck,
  Clock,
  CreditCard,
  FileText,
  IndianRupee,
  Landmark,
  Layers,
  Loader2,
  Receipt,
  RefreshCw,
  ScrollText,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ReportRow } from "@/components/reports/reportUtils";

type FeeReportType = "class-wise" | "student-wise" | "attendance-fee" | "monthly-collection" | "user-wise" | "payment-mode";
type BusReportType = "monthly" | "vehicle-wise" | "pending" | "overdue" | "yearly" | "company-wise";
type CategoryKey = "fees" | "dues" | "accounting" | "payroll" | "transport";
type FilterKey = "academic" | "classSection" | "period" | "attendance";
type PeriodMode = "academic" | "month" | "range" | "year";
type ReportKind = "fee" | "bus" | "attendance" | "link";

type ReportDefinition = {
  id: string;
  label: string;
  description: string;
  kind: ReportKind;
  type?: FeeReportType | BusReportType;
  href?: string;
  filters?: FilterKey[];
  icon: LucideIcon;
};

type ReportResult = {
  rows: ReportRow[];
  truncated: boolean;
};

const CATEGORY_META: Record<CategoryKey, { label: string; description: string; icon: LucideIcon }> = {
  fees: { label: "Fee Collection", description: "Collection, student fee and attendance-linked reports.", icon: IndianRupee },
  dues: { label: "Dues & Ledgers", description: "Outstanding fees, defaulters, statements and receipt registers.", icon: Wallet },
  accounting: { label: "Accounting", description: "Cash, bank, expense, profit & loss and balance reports.", icon: BookOpen },
  payroll: { label: "Attendance & Payroll", description: "Staff attendance and salary reports.", icon: Users },
  transport: { label: "Transport", description: "Bus EMI and vehicle finance reports.", icon: Bus }
};

const FEE_REPORTS: ReportDefinition[] = [
  {
    id: "class-wise",
    label: "Class-Wise Fee",
    description: "Fee collection and outstanding totals grouped by class.",
    kind: "fee",
    type: "class-wise",
    filters: ["academic", "classSection"],
    icon: BarChart3
  },
  {
    id: "student-wise",
    label: "Student-Wise Fee",
    description: "Student fee, paid amount and outstanding balance.",
    kind: "fee",
    type: "student-wise",
    filters: ["academic", "classSection"],
    icon: Users
  },
  {
    id: "attendance-fee",
    label: "Attendance vs Fee",
    description: "Attendance percentage compared with fee payment status.",
    kind: "fee",
    type: "attendance-fee",
    filters: ["academic", "classSection", "attendance"],
    icon: CalendarCheck
  },
  {
    id: "monthly-collection",
    label: "Monthly Collection",
    description: "Collection totals by month for the selected period.",
    kind: "fee",
    type: "monthly-collection",
    filters: ["academic", "period"],
    icon: TrendingUp
  },
  {
    id: "user-wise",
    label: "User-Wise Collection",
    description: "Collection totals grouped by the staff member who recorded it.",
    kind: "fee",
    type: "user-wise",
    filters: ["academic", "period"],
    icon: Receipt
  },
  {
    id: "payment-mode",
    label: "Payment-Mode Report",
    description: "Cash, UPI, bank, cheque and card collection split.",
    kind: "fee",
    type: "payment-mode",
    filters: ["academic", "period"],
    icon: CreditCard
  }
];

const DAILY_COLLECTION_REPORT: ReportDefinition = {
  id: "daily-collection",
  label: "Daily Collection",
  description: "Day-wise income, expense and closing balance.",
  kind: "link",
  href: "/admin/finance/collections",
  icon: CalendarCheck
};

const DUES_REPORTS: ReportDefinition[] = [
  {
    id: "dues",
    label: "Outstanding Dues",
    description: "Pending fee dues grouped by class with student drill-down.",
    kind: "link",
    href: "/admin/finance/dues",
    icon: Wallet
  },
  {
    id: "defaulters",
    label: "Defaulters",
    description: "Students with overdue fees and days overdue.",
    kind: "link",
    href: "/admin/finance/defaulters",
    icon: TrendingDown
  },
  {
    id: "ledger",
    label: "Student Ledger",
    description: "Individual student fee ledger and running balance.",
    kind: "link",
    href: "/admin/finance/ledger",
    icon: ScrollText
  },
  {
    id: "statements",
    label: "Fee Statements",
    description: "Class and student fee statements for the academic year.",
    kind: "link",
    href: "/admin/finance/statements",
    icon: FileText
  },
  {
    id: "installments",
    label: "Installments",
    description: "Installment schedule, paid and pending installments.",
    kind: "link",
    href: "/admin/finance/installments",
    icon: Layers
  },
  {
    id: "receipts",
    label: "Receipt Register",
    description: "Receipts, cancellations and payment history.",
    kind: "link",
    href: "/admin/finance/receipts",
    icon: Receipt
  },
  {
    id: "fee-reminders",
    label: "Fee Reminder Logs",
    description: "Reminder delivery, failures and retry history.",
    kind: "link",
    href: "/admin/fee-reminders",
    icon: Bell
  },
  {
    id: "deleted-bills",
    label: "Deleted Bills",
    description: "Audit view of deleted or cancelled bills.",
    kind: "link",
    href: "/admin/finance/deleted-bills",
    icon: FileText
  }
];

const ACCOUNTING_REPORTS: ReportDefinition[] = [
  {
    id: "closing",
    label: "Daily Closing",
    description: "Daily cash closing, income, expense and net balance.",
    kind: "link",
    href: "/admin/finance/collections",
    icon: CalendarCheck
  },
  {
    id: "cash-book",
    label: "Cash Book",
    description: "All cash transactions with running balance.",
    kind: "link",
    href: "/admin/finance/cash-book",
    icon: Banknote
  },
  {
    id: "bank-book",
    label: "Bank Book",
    description: "Bank account transactions and balances.",
    kind: "link",
    href: "/admin/finance/banking",
    icon: Landmark
  },
  {
    id: "expenses",
    label: "Expense Report",
    description: "Category-wise expenses and approval status.",
    kind: "link",
    href: "/admin/finance/expenses",
    icon: Wallet
  },
  {
    id: "profit-loss",
    label: "Profit & Loss",
    description: "Income vs expense summary for the selected period.",
    kind: "link",
    href: "/admin/finance/profit-loss",
    icon: TrendingUp
  },
  {
    id: "trial-balance",
    label: "Trial Balance",
    description: "Debit and credit balances for the selected period.",
    kind: "link",
    href: "/admin/finance/trial-balance",
    icon: BookOpen
  },
  {
    id: "receivables",
    label: "Receivables",
    description: "Outstanding amounts receivable by student or account.",
    kind: "link",
    href: "/admin/finance/receivables",
    icon: IndianRupee
  },
  {
    id: "payables",
    label: "Payables",
    description: "Vendor and other amounts payable.",
    kind: "link",
    href: "/admin/finance/payables",
    icon: CreditCard
  },
  {
    id: "invoices",
    label: "Invoices",
    description: "Fee and other invoices issued by the school.",
    kind: "link",
    href: "/admin/finance/invoices",
    icon: FileText
  },
  {
    id: "branch-accounts",
    label: "Branch Accounts",
    description: "Branch-wise account and balance summary.",
    kind: "link",
    href: "/admin/finance/branch-accounts",
    icon: Users
  },
  {
    id: "vendors",
    label: "Vendors",
    description: "Vendor list with payment and balance details.",
    kind: "link",
    href: "/admin/finance/vendors",
    icon: Users
  }
];

const ATTENDANCE_REPORT: ReportDefinition = {
  id: "attendance",
  label: "Attendance & Salary",
  description: "Staff attendance, monthly summary and salary report.",
  kind: "attendance",
  icon: Users
};

const BUS_REPORTS: ReportDefinition[] = [
  {
    id: "bus-monthly",
    label: "Monthly Bus EMI",
    description: "EMI due, paid and status for a selected month.",
    kind: "bus",
    type: "monthly",
    filters: ["academic"],
    icon: Bus
  },
  {
    id: "bus-vehicle-wise",
    label: "Vehicle-Wise EMI",
    description: "Loan, paid amount and outstanding by vehicle.",
    kind: "bus",
    type: "vehicle-wise",
    filters: ["academic"],
    icon: Bus
  },
  {
    id: "bus-pending",
    label: "Pending EMI",
    description: "Pending and partially paid EMIs with due dates.",
    kind: "bus",
    type: "pending",
    filters: ["academic", "period"],
    icon: Clock
  },
  {
    id: "bus-overdue",
    label: "Overdue EMI",
    description: "Overdue EMIs, overdue amount and late fee.",
    kind: "bus",
    type: "overdue",
    filters: ["academic", "period"],
    icon: TrendingDown
  },
  {
    id: "bus-yearly",
    label: "Yearly EMI Paid",
    description: "Year-wise EMI paid amount and number of EMIs paid.",
    kind: "bus",
    type: "yearly",
    filters: ["academic"],
    icon: TrendingUp
  },
  {
    id: "bus-company-wise",
    label: "Finance Company-Wise",
    description: "Loans, paid amount and outstanding by finance company.",
    kind: "bus",
    type: "company-wise",
    filters: ["academic"],
    icon: Landmark
  }
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return "";
  return `${year}-${pad(monthNumber)}-${pad(new Date(year, monthNumber, 0).getDate())}`;
}

function periodRange(period: PeriodMode, selectedYear: { startDate: string; endDate: string } | null, month: string, from: string, to: string, year: string) {
  if (period === "academic" && selectedYear) return { from: selectedYear.startDate, to: selectedYear.endDate };
  if (period === "month" && month) return { from: `${month}-01`, to: monthEnd(month) };
  if (period === "range") return { from, to };
  if (period === "year" && year) return { from: `${year}-01-01`, to: `${year}-12-31` };
  return { from: "", to: "" };
}

function periodLabel(period: PeriodMode, month: string, from: string, to: string, year: string) {
  if (period === "academic") return "Academic year";
  if (period === "month") return month || "Month";
  if (period === "range") return from || to ? `${from || "Start"} to ${to || "Today"}` : "Date range";
  if (period === "year") return year || "Year";
  return "All time";
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-[150px] text-sm font-semibold text-[#303247]">
      <span className="mb-1 block text-xs font-bold uppercase tracking-[0.03em] text-[#7d86a8]">{label}</span>
      {children}
    </label>
  );
}

function FeeFilterBar({
  report,
  selectedYear,
  years,
  onYearChange,
  period,
  setPeriod,
  month,
  setMonth,
  from,
  setFrom,
  to,
  setTo,
  year,
  setYear,
  classId,
  setClassId,
  section,
  setSection,
  sectionOptions,
  minAttendance,
  setMinAttendance,
  maxAttendance,
  setMaxAttendance
}: {
  report: ReportDefinition;
  selectedYear: AcademicYear | null;
  years: AcademicYear[];
  onYearChange: (id: string) => void;
  period: PeriodMode;
  setPeriod: (value: PeriodMode) => void;
  month: string;
  setMonth: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
  classId: string;
  setClassId: (value: string) => void;
  section: string;
  setSection: (value: string) => void;
  sectionOptions: string[];
  minAttendance: string;
  setMinAttendance: (value: string) => void;
  maxAttendance: string;
  setMaxAttendance: (value: string) => void;
}) {
  const filters = report.filters ?? [];
  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        {filters.includes("academic") && (
          <FilterField label="Academic year">
            <select className="field" value={selectedYear?.id ?? ""} onChange={(event) => onYearChange(event.target.value)}>
              <option value="">Select academic year</option>
              {years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </FilterField>
        )}

        {filters.includes("classSection") && (
          <>
            <FilterField label="Class">
              <select
                className="field"
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setSection("");
                }}
              >
                <option value="">All classes</option>
                {CLASS_OPTIONS.map((item) => <option key={item} value={item}>{CLASS_LABELS[item] ?? item}</option>)}
              </select>
            </FilterField>
            <FilterField label="Section">
              <select className="field" value={section} onChange={(event) => setSection(event.target.value)}>
                <option value="">All sections</option>
                {sectionOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </FilterField>
          </>
        )}

        {filters.includes("period") && (
          <>
            <FilterField label="Period">
              <select className="field" value={period} onChange={(event) => setPeriod(event.target.value as PeriodMode)}>
                <option value="academic">Academic year</option>
                <option value="month">Month</option>
                <option value="range">Date range</option>
                <option value="year">Year</option>
              </select>
            </FilterField>
            {period === "month" && (
              <FilterField label="Month">
                <DatePicker type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </FilterField>
            )}
            {period === "range" && (
              <>
                <FilterField label="From">
                  <DatePicker value={from} onChange={(event) => setFrom(event.target.value)} />
                </FilterField>
                <FilterField label="To">
                  <DatePicker value={to} onChange={(event) => setTo(event.target.value)} />
                </FilterField>
              </>
            )}
            {period === "year" && (
              <FilterField label="Year">
                <input className="field" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
              </FilterField>
            )}
          </>
        )}

        {filters.includes("attendance") && (
          <>
            <FilterField label="Min attendance %">
              <input className="field" type="number" min="0" max="100" value={minAttendance} onChange={(event) => setMinAttendance(event.target.value)} />
            </FilterField>
            <FilterField label="Max attendance %">
              <input className="field" type="number" min="0" max="100" value={maxAttendance} onChange={(event) => setMaxAttendance(event.target.value)} />
            </FilterField>
          </>
        )}
      </div>
      {filters.includes("period") && (
        <p className="text-xs font-medium text-[#7d86a8]">
          Academic year uses the selected year dates. Month and date range apply to collection reports only.
        </p>
      )}
    </div>
  );
}

function BusFilterBar({
  report,
  selectedYear,
  years,
  onYearChange,
  period,
  setPeriod,
  month,
  setMonth,
  from,
  setFrom,
  to,
  setTo,
  year,
  setYear
}: {
  report: ReportDefinition;
  selectedYear: AcademicYear | null;
  years: AcademicYear[];
  onYearChange: (id: string) => void;
  period: PeriodMode;
  setPeriod: (value: PeriodMode) => void;
  month: string;
  setMonth: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
}) {
  return (
    <div className="card space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label="Academic year">
          <select className="field" value={selectedYear?.id ?? ""} onChange={(event) => onYearChange(event.target.value)}>
            <option value="">Select academic year</option>
            {years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </FilterField>
        {report.type === "monthly" && (
          <FilterField label="Month">
            <DatePicker type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </FilterField>
        )}
        {report.type === "yearly" && (
          <FilterField label="Year">
            <input className="field" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
          </FilterField>
        )}
        {(report.type === "pending" || report.type === "overdue") && (
          <>
            <FilterField label="Period">
              <select className="field" value={period} onChange={(event) => setPeriod(event.target.value as PeriodMode)}>
                <option value="academic">Academic year</option>
                <option value="month">Month</option>
                <option value="range">Date range</option>
                <option value="year">Year</option>
              </select>
            </FilterField>
            {period === "month" && (
              <FilterField label="Month">
                <DatePicker type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
              </FilterField>
            )}
            {period === "range" && (
              <>
                <FilterField label="From">
                  <DatePicker value={from} onChange={(event) => setFrom(event.target.value)} />
                </FilterField>
                <FilterField label="To">
                  <DatePicker value={to} onChange={(event) => setTo(event.target.value)} />
                </FilterField>
              </>
            )}
            {period === "year" && (
              <FilterField label="Year">
                <input className="field" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} />
              </FilterField>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type AttendancePayload = {
  records: AttendanceRecord[];
  teachers: Teacher[];
};

function AttendanceReportsSection({ canViewSalary }: { canViewSalary: boolean }) {
  const { selectedYear } = useAcademicYears();
  const today = new Date();
  const [fromDate, setFromDate] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(isoDate(today));
  const [month, setMonth] = useState(currentMonth());
  const [teacherId, setTeacherId] = useState("");
  const [status, setStatus] = useState("all");
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [salaryReports, setSalaryReports] = useState<SalaryReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadReportData = useCallback(async (options?: { from?: string; to?: string; month?: string }) => {
    const nextFrom = options?.from ?? fromDate;
    const nextTo = options?.to ?? toDate;
    const nextMonth = options?.month ?? month;
    if (!selectedYear?.id) {
      setAttendance([]);
      setTeachers([]);
      setSalaryReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in as admin again.");
      const attendanceParams = new URLSearchParams({
        academicYearId: selectedYear.id,
        pageSize: "100"
      });
      if (nextFrom) attendanceParams.set("dateFrom", nextFrom);
      if (nextTo) attendanceParams.set("dateTo", nextTo);
      if (teacherId) attendanceParams.set("teacherId", teacherId);
      if (status !== "all") attendanceParams.set("status", status);

      const attendanceResponse = fetch(`/api/admin/attendance?${attendanceParams.toString()}`, {
        headers: { authorization: `Bearer ${token}` }
      }).then(async (response) => {
        const result = await response.json();
        if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
        return result as AttendancePayload;
      });

      const salaryResponse = canViewSalary
        ? fetch(`/api/admin/salary?month=${encodeURIComponent(nextMonth)}`, {
            headers: { authorization: `Bearer ${token}` }
          }).then(async (response) => {
            const result = await response.json();
            if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
            return result as { reports: SalaryReport[] };
          })
        : Promise.resolve({ reports: [] as SalaryReport[] });

      const [attendanceResult, salaryResult] = await Promise.all([attendanceResponse, salaryResponse]);
      setAttendance(attendanceResult.records ?? []);
      setTeachers(attendanceResult.teachers ?? []);
      setSalaryReports(salaryResult.reports ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  }, [canViewSalary, fromDate, month, selectedYear?.id, status, teacherId, toDate]);

  useEffect(() => {
    void loadReportData();
  }, [loadReportData]);

  const dailyRows = buildDailyAttendanceRows(attendance, teachers);
  const salaryRows = buildSalaryRows(salaryReports);
  const attendanceMeta = selectedYear?.name ? `Academic year: ${selectedYear.name}` : "";

  return (
    <div className="space-y-4">
      {error && <div className="card border-l-4 border-[#d84d5b] p-4 text-sm font-semibold text-[#d84d5b]">{error}</div>}
      <DateRangeFilter
        from={fromDate}
        to={toDate}
        onChange={({ from, to }) => {
          setFromDate(from);
          setToDate(to);
        }}
        onApply={({ from, to }) => {
          setFromDate(from);
          setToDate(to);
          const nextMonth = from ? from.slice(0, 7) : month;
          setMonth(nextMonth);
          void loadReportData({ from, to, month: nextMonth });
        }}
        loading={loading}
        rightSlot={<button type="button" className="btn-secondary" onClick={() => void loadReportData()} disabled={loading}><RefreshCw size={16} /> Refresh</button>}
      />

      <div className="card grid gap-3 p-4 md:grid-cols-2">
        <FilterField label="Teacher">
          <select className="field" value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
            <option value="">All teachers</option>
            {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
          </select>
        </FilterField>
        <FilterField label="Attendance status">
          <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="cl">CL</option>
            <option value="holiday">Holiday</option>
            <option value="half_day">Half day</option>
            <option value="short_hours">Short hours</option>
          </select>
        </FilterField>
      </div>

      {loading && attendance.length === 0 ? (
        <div className="card flex items-center justify-center gap-3 p-10 text-sm font-semibold text-[#7d86a8]">
          <Loader2 className="animate-spin" size={18} /> Loading attendance...
        </div>
      ) : (
        <ReportTable
          title="Attendance Report"
          rows={dailyRows}
          meta={attendanceMeta}
          truncated={attendance.length >= 100}
          emptyText="No attendance records for the selected filters."
        />
      )}

      {canViewSalary && (
        <ReportTable
          title="Salary Report"
          rows={salaryRows}
          meta={`Month: ${month}`}
          emptyText="No salary records for the selected month."
        />
      )}

      <div className="card space-y-3 p-4">
        <div>
          <h3 className="text-sm font-extrabold text-[#1f2136]">Additional exports</h3>
          <p className="mt-1 text-xs font-medium text-[#7d86a8]">Monthly attendance, salary and biometric exports.</p>
        </div>
        <ExportButtons attendance={attendance} teachers={teachers} salaryReports={salaryReports} showSalary={canViewSalary} />
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const { role } = useAdminSession();
  const { years, selectedYear, setSelectedYear } = useAcademicYears();
  const { sectionsFor } = useClassSections();

  const canViewReports = Boolean(role && hasPermission(role, "reports.view"));
  const canViewFees = Boolean(role && hasPermission(role, "fees.view"));
  const canViewBus = Boolean(role && hasPermission(role, "bus_finance.export"));
  const canViewAttendance = Boolean(role && hasPermission(role, "attendance.view"));
  const canViewSalary = Boolean(role && hasPermission(role, "salary.view"));

  const categoryReports = useMemo<Record<CategoryKey, ReportDefinition[]>>(() => {
    const feeReports = canViewReports ? [...FEE_REPORTS] : [];
    if (canViewFees) feeReports.push(DAILY_COLLECTION_REPORT);
    return {
      fees: feeReports,
      dues: canViewFees ? DUES_REPORTS : [],
      accounting: canViewFees ? ACCOUNTING_REPORTS : [],
      payroll: canViewReports && canViewAttendance ? [ATTENDANCE_REPORT] : [],
      transport: canViewBus ? BUS_REPORTS : []
    };
  }, [canViewBus, canViewFees, canViewReports, canViewAttendance]);

  const categories = useMemo(
    () => (Object.keys(CATEGORY_META) as CategoryKey[]).filter((key) => categoryReports[key].length > 0),
    [categoryReports]
  );

  const [category, setCategory] = useState<CategoryKey>("fees");
  const [activeReportId, setActiveReportId] = useState("");
  const [period, setPeriod] = useState<PeriodMode>("academic");
  const [month, setMonth] = useState(currentMonth());
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(isoDate(new Date()));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [classId, setClassId] = useState("");
  const [section, setSection] = useState("");
  const [minAttendance, setMinAttendance] = useState("");
  const [maxAttendance, setMaxAttendance] = useState("");
  const [result, setResult] = useState<ReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const reports = useMemo(() => categoryReports[category] ?? [], [category, categoryReports]);
  const selectableReports = useMemo(() => reports.filter((report) => report.kind !== "link"), [reports]);
  const activeReport = selectableReports.find((report) => report.id === activeReportId) ?? selectableReports[0];
  const sectionOptions = classId ? sectionsFor(classId) : SECTION_OPTIONS;

  useEffect(() => {
    if (categories.length > 0 && !categories.includes(category)) setCategory(categories[0]);
  }, [categories, category]);

  useEffect(() => {
    if (selectableReports.length === 0) {
      setActiveReportId("");
      return;
    }
    if (!selectableReports.some((report) => report.id === activeReportId)) {
      setActiveReportId(selectableReports[0].id);
    }
  }, [activeReportId, selectableReports]);

  useEffect(() => {
    setResult(null);
    setError("");
  }, [activeReport?.id, selectedYear?.id]);

  const range = periodRange(period, selectedYear, month, from, to, year);
  const reportMeta = [
    selectedYear?.name ? `Academic year: ${selectedYear.name}` : "",
    activeReport?.filters?.includes("classSection") && classId ? `Class: ${CLASS_LABELS[classId] ?? classId}` : "",
    activeReport?.filters?.includes("classSection") && section ? `Section: ${section}` : "",
    activeReport?.filters?.includes("period") ? `Period: ${periodLabel(period, month, from, to, year)}` : "",
    activeReport?.kind === "bus" && activeReport.type === "monthly" ? `Month: ${month}` : "",
    activeReport?.kind === "bus" && activeReport.type === "yearly" ? `Year: ${year}` : "",
    activeReport?.filters?.includes("attendance") && (minAttendance || maxAttendance)
      ? `Attendance: ${minAttendance || "0"}% to ${maxAttendance || "100"}%`
      : ""
  ].filter(Boolean).join(" · ");

  async function generateReport() {
    if (!activeReport || activeReport.kind === "link" || activeReport.kind === "attendance") return;
    if (!selectedYear?.id) {
      setError("Select an academic year to generate this report.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      if (activeReport.kind === "fee" && activeReport.type) {
        const params = new URLSearchParams({ academicYearId: selectedYear.id });
        if (activeReport.filters?.includes("classSection")) {
          if (classId) {
            params.set("class", classId);
            params.set("classId", classId);
          }
          if (section) {
            params.set("section", section);
            params.set("sectionId", section);
          }
        }
        if (activeReport.type === "class-wise") params.set("pageSize", "5000");
        if (activeReport.type === "student-wise") params.set("pageSize", "500");
        if (activeReport.type === "attendance-fee") {
          params.set("pageSize", "500");
          if (minAttendance) params.set("minAttendance", minAttendance);
          if (maxAttendance) params.set("maxAttendance", maxAttendance);
        }
        if (["monthly-collection", "user-wise", "payment-mode"].includes(activeReport.type)) {
          if (range.from) params.set("from", range.from);
          if (range.to) params.set("to", range.to);
          if (activeReport.type === "monthly-collection") {
            params.set("year", range.from ? range.from.slice(0, 4) : year);
          }
        }
        const response = await adminApiRequest<{
          success?: boolean;
          data?: ReportRow[];
          months?: ReportRow[];
          truncated?: boolean;
        }>(`/api/admin/reports/${activeReport.type}?${params.toString()}`);
        setResult({
          rows: (activeReport.type === "monthly-collection" ? response.months : response.data) ?? [],
          truncated: Boolean(response.truncated)
        });
      }

      if (activeReport.kind === "bus" && activeReport.type) {
        const params = new URLSearchParams({
          type: activeReport.type,
          academicYearId: selectedYear.id,
          pageSize: "1000"
        });
        if (activeReport.type === "monthly") params.set("month", month);
        if (activeReport.type === "yearly") params.set("year", year);
        if (activeReport.type === "pending" || activeReport.type === "overdue") {
          if (range.from) params.set("from", range.from);
          if (range.to) params.set("to", range.to);
          params.set("asOf", to || isoDate(new Date()));
        }
        const response = await adminApiRequest<{ ok: boolean; rows: ReportRow[]; truncated?: boolean }>(
          `/api/admin/bus-finance/reports?${params.toString()}`
        );
        setResult({ rows: response.rows ?? [], truncated: Boolean(response.truncated) });
      }
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  const activeCategory = CATEGORY_META[category];

  return (
    <>
      <PageHeader
        title="Reports"
        description="Fee, dues, accounting, attendance, payroll and transport reports with academic-year and date filters."
      />
      <section className="space-y-5 p-4 md:p-7">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-extrabold text-[#1f2136]">Academic year</p>
            <p className="mt-1 text-xs font-medium text-[#7d86a8]">Reports use this year unless a report period overrides it.</p>
          </div>
          <select
            className="field max-w-xs"
            value={selectedYear?.id ?? ""}
            onChange={(event) => setSelectedYear(event.target.value)}
          >
            <option value="">Select academic year</option>
            {years.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        {!selectedYear?.id && (
          <div className="card p-5 text-sm font-semibold text-[#7d86a8]">
            Select an academic year to load academic-year and payroll reports. Date-based collection reports can still use a month, date range or year.
          </div>
        )}

        {categories.length === 0 && (
          <div className="card p-5 text-sm font-semibold text-[#d84d5b]">Your role does not have access to any reports.</div>
        )}

        {categories.length > 0 && (
          <div className="card flex gap-2 overflow-x-auto p-2">
            {categories.map((key) => {
              const meta = CATEGORY_META[key];
              const Icon = meta.icon;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    category === key
                      ? "bg-[#3033a1] text-white shadow-[0_8px_18px_rgba(48,51,161,0.16)]"
                      : "text-[#6f7898] hover:bg-[#f4f5fb] hover:text-[#3033a1]"
                  }`}
                >
                  <Icon size={16} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <div className="mb-3">
              <h2 className="text-lg font-extrabold text-[#1f2136]">{activeCategory.label}</h2>
              <p className="text-sm font-medium text-[#7d86a8]">{activeCategory.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {reports.map((report) => {
                const Icon = report.icon;
                const active = activeReport?.id === report.id;
                const content = (
                  <>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${active ? "bg-white/15 text-white" : "bg-[#eef2ff] text-[#3033a1]"}`}>
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold">{report.label}</span>
                      <span className={`mt-1 block text-xs font-medium leading-5 ${active ? "text-white/75" : "text-[#7d86a8]"}`}>{report.description}</span>
                    </span>
                    {report.kind === "link" && <ArrowUpRight size={16} className="shrink-0" />}
                  </>
                );

                if (report.kind === "link" && report.href) {
                  return (
                    <Link
                      key={report.id}
                      href={report.href}
                      className="flex items-start gap-3 rounded-2xl border border-[#e3e6f0] bg-white p-4 text-left text-[#1f2136] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c7cdf0] hover:shadow-md"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setActiveReportId(report.id)}
                    className={`flex items-start gap-3 rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      active
                        ? "border-[#3033a1] bg-[#3033a1] text-white"
                        : "border-[#e3e6f0] bg-white text-[#1f2136] hover:border-[#c7cdf0]"
                    }`}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
            {reports.every((report) => report.kind === "link") && (
              <p className="mt-3 text-xs font-medium text-[#7d86a8]">
                These reports open dedicated pages with their own filters and exports.
              </p>
            )}
          </div>
        )}

        {activeReport?.kind === "fee" && (
          <>
            <FeeFilterBar
              report={activeReport}
              selectedYear={selectedYear}
              years={years}
              onYearChange={setSelectedYear}
              period={period}
              setPeriod={setPeriod}
              month={month}
              setMonth={setMonth}
              from={from}
              setFrom={setFrom}
              to={to}
              setTo={setTo}
              year={year}
              setYear={setYear}
              classId={classId}
              setClassId={setClassId}
              section={section}
              setSection={setSection}
              sectionOptions={sectionOptions}
              minAttendance={minAttendance}
              setMinAttendance={setMinAttendance}
              maxAttendance={maxAttendance}
              setMaxAttendance={setMaxAttendance}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" onClick={() => void generateReport()} disabled={loading || !selectedYear?.id}>
                {loading ? <Loader2 className="animate-spin" size={17} /> : <BarChart3 size={17} />}
                {loading ? "Generating..." : "Generate Report"}
              </button>
              <span className="text-sm font-semibold text-[#7d86a8]">{reportMeta}</span>
            </div>
            <ReportTable
              title={activeReport.label}
              rows={result?.rows ?? []}
              meta={reportMeta}
              loading={loading}
              error={error}
              truncated={Boolean(result?.truncated)}
              emptyText="Choose filters and generate the report."
            />
          </>
        )}

        {activeReport?.kind === "bus" && (
          <>
            <BusFilterBar
              report={activeReport}
              selectedYear={selectedYear}
              years={years}
              onYearChange={setSelectedYear}
              period={period}
              setPeriod={setPeriod}
              month={month}
              setMonth={setMonth}
              from={from}
              setFrom={setFrom}
              to={to}
              setTo={setTo}
              year={year}
              setYear={setYear}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" onClick={() => void generateReport()} disabled={loading || !selectedYear?.id}>
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Bus size={17} />}
                {loading ? "Generating..." : "Generate Report"}
              </button>
              <span className="text-sm font-semibold text-[#7d86a8]">{reportMeta}</span>
            </div>
            <ReportTable
              title={activeReport.label}
              rows={result?.rows ?? []}
              meta={reportMeta}
              loading={loading}
              error={error}
              truncated={Boolean(result?.truncated)}
              emptyText="Choose filters and generate the report."
            />
          </>
        )}

        {activeReport?.kind === "attendance" && <AttendanceReportsSection canViewSalary={canViewSalary} />}
      </section>
    </>
  );
}
