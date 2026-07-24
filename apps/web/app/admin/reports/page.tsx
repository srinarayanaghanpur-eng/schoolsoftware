"use client";

import { ExportButtons } from "@/components/ExportButtons";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { auth } from "@sri-narayana/shared/firebase/client";
import { hasPermission } from "@sri-narayana/shared";
import type { AttendanceRecord, SalaryReport, Teacher } from "@sri-narayana/shared";
import { FileDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type AttendancePayload = {
  records: AttendanceRecord[];
  teachers: Teacher[];
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

/* ----------------------------- Fee reports ----------------------------- */

type FeeTabType = "class-wise" | "student-wise" | "attendance-fee" | "monthly-collection" | "user-wise" | "payment-mode";

interface FeeReportData {
  type: FeeTabType;
  data: any[];
  loading: boolean;
  error: string;
}

const FEE_REPORT_CONFIG: Record<FeeTabType, { label: string; description: string }> = {
  "class-wise": { label: "Class-Wise Fee Report", description: "Fee collection and due summary across classes" },
  "student-wise": { label: "Student-Wise Fee Report", description: "Detailed fee and payment status for each student" },
  "attendance-fee": { label: "Attendance vs Fee Report", description: "Analyze attendance against fee payment status" },
  "monthly-collection": { label: "Monthly Collection", description: "Payment collection totals broken down by month" },
  "user-wise": { label: "User-Wise Collection", description: "Collections grouped by the user who recorded each payment" },
  "payment-mode": { label: "Payment-Mode Report", description: "Collections grouped by mode — cash, UPI, bank, cheque, card" }
};

function FeeReportsSection() {
  const [activeTab, setActiveTab] = useState<FeeTabType>("class-wise");
  const [reports, setReports] = useState<Record<string, FeeReportData>>(() =>
    Object.fromEntries(
      (Object.keys(FEE_REPORT_CONFIG) as FeeTabType[]).map((type) => [type, { type, data: [], loading: false, error: "" }])
    )
  );

  const generateReport = async (reportType: FeeTabType) => {
    try {
      setReports((prev) => ({ ...prev, [reportType]: { ...prev[reportType], loading: true, error: "" } }));
      const data = await adminApiRequest<{ success?: boolean; data?: any[]; months?: any[] }>(`/api/admin/reports/${reportType}`);
      const reportData = (reportType === "monthly-collection" ? data.months : data.data) ?? [];
      setReports((prev) => ({ ...prev, [reportType]: { ...prev[reportType], data: reportData, loading: false } }));
    } catch (error) {
      const message =
        error instanceof AdminApiError ? error.message : error instanceof Error ? error.message : "Failed to generate report";
      setReports((prev) => ({ ...prev, [reportType]: { ...prev[reportType], loading: false, error: message } }));
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    const csv = [
      Object.keys(data[0] || {}).join(","),
      ...data.map((row) =>
        Object.values(row)
          .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v))
          .join(",")
      )
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const report = reports[activeTab];
  const config = FEE_REPORT_CONFIG[activeTab];

  return (
    <div className="space-y-5">
      <div className="card flex gap-2 overflow-x-auto p-2">
        {Object.entries(FEE_REPORT_CONFIG).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => setActiveTab(type as FeeTabType)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
              activeTab === type
                ? "bg-[#3033a1] text-white shadow-[0_8px_18px_rgba(48,51,161,0.16)]"
                : "text-[#6f7898] hover:bg-[#f4f5fb] hover:text-[#3033a1]"
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#1f2136]">{config.label}</h3>
            <p className="text-sm font-medium text-[#7d86a8]">{config.description}</p>
          </div>
          <button onClick={() => generateReport(activeTab)} disabled={report.loading} className="btn-primary">
            {report.loading ? "Generating..." : "Generate Report"}
          </button>
        </div>

        {report.error && (
          <div className="rounded-xl border border-[#ffd5da] bg-[#ffebed] p-4 text-sm font-semibold text-[#c83f4d]">{report.error}</div>
        )}

        {report.data.length > 0 && (
          <>
            <div className="flex gap-2">
              <button onClick={() => exportToCSV(report.data, `${activeTab}-report`)} className="btn-secondary">
                <FileDown size={18} /> Export CSV
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-[#f7f8fd]">
                    <tr>
                      {Object.keys(report.data[0] || {}).map((key) => (
                        <th key={key} className="border-b border-[#edf0f7] px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">
                          {key.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.data.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff]">
                        {Object.values(row).map((value, cidx) => (
                          <td key={cidx} className="px-4 py-3 text-sm font-medium text-[#303247]">
                            {typeof value === "number" && value > 100 ? `₹${value.toLocaleString("en-IN")}` : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-sm font-semibold text-[#7d86a8]">Total Records: {report.data.length}</p>
          </>
        )}

        {!report.loading && report.data.length === 0 && !report.error && (
          <div className="rounded-xl bg-[#f7f8fd] py-12 text-center text-sm font-medium text-[#7d86a8]">
            Click "Generate Report" to view data
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------- Attendance & salary ------------------------- */

function AttendanceReportsSection({ canViewSalary }: { canViewSalary: boolean }) {
  const { selectedYear } = useAcademicYears();
  const today = new Date();
  const [fromDate, setFromDate] = useState(isoDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(isoDate(today));
  const [month, setMonth] = useState(currentMonth());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [salaryReports, setSalaryReports] = useState<SalaryReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiRequest = async <T,>(path: string): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please sign in as admin again.");
    const response = await fetch(path, { headers: { authorization: `Bearer ${token}` } });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
    return result;
  };

  const loadReportData = async (reportMonth = month) => {
    if (!selectedYear?.id) {
      setAttendance([]);
      setTeachers([]);
      setSalaryReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const attendancePromise = apiRequest<AttendancePayload>(
        `/api/admin/attendance?${new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "25" })}`
      );
      // Salary data is super_admin only — others never request it, so no
      // "Payroll access denied" banner for accountant/principal.
      const salaryPromise = canViewSalary
        ? apiRequest<{ reports: SalaryReport[] }>(`/api/admin/salary?month=${encodeURIComponent(reportMonth)}`)
        : Promise.resolve({ reports: [] as SalaryReport[] });
      const [attendanceResult, salaryResult] = await Promise.all([attendancePromise, salaryPromise]);
      setAttendance(attendanceResult.records);
      setTeachers(attendanceResult.teachers);
      setSalaryReports(salaryResult.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, selectedYear?.id, canViewSalary]);

  const filteredAttendance = attendance.filter((record) => (!fromDate || record.date >= fromDate) && (!toDate || record.date <= toDate));

  return (
    <div className="space-y-5">
      {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
      <DateRangeFilter
        from={fromDate}
        to={toDate}
        onChange={({ from, to }) => { setFromDate(from); setToDate(to); }}
        onApply={({ from, to }) => {
          setFromDate(from);
          setToDate(to);
          const nextMonth = from ? from.slice(0, 7) : month;
          setMonth(nextMonth);
          void loadReportData(nextMonth);
        }}
        loading={loading}
      />
      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <select className="field"><option>All teachers</option></select>
        <select className="field"><option>All subjects</option></select>
        <select className="field"><option>All statuses</option></select>
      </div>
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#7d86a8]">
            {loading
              ? "Loading report data..."
              : `${filteredAttendance.length} attendance rows${canViewSalary ? `, ${salaryReports.length} salary rows` : ""}`}
          </p>
          <button className="btn-secondary" onClick={() => loadReportData()} disabled={loading}>Refresh</button>
        </div>
        <ExportButtons attendance={filteredAttendance} teachers={teachers} salaryReports={salaryReports} showSalary={canViewSalary} />
      </div>
    </div>
  );
}

/* ------------------------------ Merged page ---------------------------- */

type SectionKey = "attendance" | "fees";

export default function ReportsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();

  // Section availability by role. Salary exports are super_admin only.
  const canViewSalary = role === "super_admin";
  const canViewAttendance = Boolean(role && hasPermission(role, "reports.view"));
  const canViewFees = Boolean(role && hasPermission(role, "fees.view"));

  const sections = useMemo(() => {
    const list: { key: SectionKey; label: string }[] = [];
    if (canViewAttendance) list.push({ key: "attendance", label: canViewSalary ? "Attendance & Salary" : "Attendance" });
    if (canViewFees) list.push({ key: "fees", label: "Fee Reports" });
    return list;
  }, [canViewAttendance, canViewFees, canViewSalary]);

  const [section, setSection] = useState<SectionKey | null>(null);
  const activeSection = section && sections.some((s) => s.key === section) ? section : sections[0]?.key ?? null;

  return (
    <>
      <PageHeader
        title="Reports"
        description="All reports in one place — attendance, salary, biometric and fee reports, shown according to your role."
      />
      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load reports.</div>}

        {sections.length === 0 && (
          <div className="card p-5 text-sm font-semibold text-[#d84d5b]">Your role does not have access to any reports.</div>
        )}

        {sections.length > 1 && (
          <div className="card flex gap-2 overflow-x-auto p-2">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  activeSection === s.key
                    ? "bg-[#3033a1] text-white shadow-[0_8px_18px_rgba(48,51,161,0.16)]"
                    : "text-[#6f7898] hover:bg-[#f4f5fb] hover:text-[#3033a1]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {activeSection === "attendance" && <AttendanceReportsSection canViewSalary={canViewSalary} />}
        {activeSection === "fees" && <FeeReportsSection />}
      </section>
    </>
  );
}
