"use client";

import { useAdminSession } from "@/components/AdminSessionContext";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PageHeader } from "@/components/PageHeader";
import { SalaryAdvancesPanel } from "@/components/SalaryAdvancesPanel";
import { auth } from "@sri-narayana/shared/firebase/client";
import type { SalaryReport } from "@sri-narayana/shared";
import { AlertCircle, Check, CheckCircle2, Download, LockKeyhole, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
// xlsx is ~400KB — loaded on demand inside exportToExcel instead of at page
// load, so opening the Salary page stays fast.
import { payrollSessionHeaders } from "@/lib/payrollSessionClient";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const end = new Date(year, monthNumber, 0).getDate();
  return {
    from: `${year}-${String(monthNumber).padStart(2, "0")}-01`,
    to: `${year}-${String(monthNumber).padStart(2, "0")}-${String(end).padStart(2, "0")}`
  };
}

type PayrollAccessRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  accountantUserId: string;
  accountantName?: string;
  accountantEmail?: string;
  schoolId?: string;
  branchId?: string;
  academicYearId?: string;
  dateKey?: string;
  requestedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNote?: string;
};

type PayrollAccessState = {
  access: "direct" | "approved" | "locked";
  status?: "none" | "pending" | "approved" | "rejected" | "missing_session";
  request?: PayrollAccessRequest | null;
};

function formatDateTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function roundMoney(value?: number) {
  return Math.round((value ?? 0) * 100) / 100;
}

function money(value?: number) {
  return (value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function approvedPaidCLDays(report: SalaryReport) {
  return report.approvedPaidCLDays ?? report.paidCLDays ?? report.paidLeaveDays ?? report.clDays ?? 0;
}

function unpaidAbsentDays(report: SalaryReport) {
  return report.unpaidAbsentDays ?? report.unpaidDeductionDays ?? report.absentDays ?? 0;
}

export default function SalaryPage() {
  const { role } = useAdminSession();
  const isAccountant = role === "accountant";
  const canReviewPayrollAccess = role === "super_admin" || role === "admin";
  const [month, setMonth] = useState(currentMonth());
  const [dateRange, setDateRange] = useState(() => monthRange(currentMonth()));
  const [reports, setReports] = useState<SalaryReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [accessLoading, setAccessLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [payrollAccess, setPayrollAccess] = useState<PayrollAccessState | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<PayrollAccessRequest[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const apiRequest = async <T,>(path: string, init?: RequestInit, includePayrollSession = false): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please sign in as admin again.");
    const payrollHeaders = includePayrollSession ? await payrollSessionHeaders() : {};
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...payrollHeaders,
        ...(init?.headers ?? {})
      }
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
    return result;
  };

  const loadPayrollAccess = async () => {
    if (!isAccountant) {
      setPayrollAccess(isAccountant ? { access: "locked", status: "none" } : { access: "direct" });
      return;
    }

    setAccessLoading(true);
    setError(null);
    try {
      const result = await apiRequest<PayrollAccessState>("/api/admin/payroll-access", undefined, true);
      setPayrollAccess(result);
    } catch (err) {
      setPayrollAccess({ access: "locked", status: "none" });
      setError(err instanceof Error ? err.message : "Unable to check payroll approval");
    } finally {
      setAccessLoading(false);
    }
  };

  const loadApprovalRequests = async () => {
    if (!canReviewPayrollAccess) return;
    setApprovalLoading(true);
    try {
      const result = await apiRequest<{ requests: PayrollAccessRequest[] }>("/api/admin/payroll-access?scope=requests");
      setApprovalRequests(result.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payroll approval requests");
    } finally {
      setApprovalLoading(false);
    }
  };

  const loadReports = async (targetMonth = month) => {
    if (isAccountant && payrollAccess?.access !== "approved") return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ reports: SalaryReport[] }>(`/api/admin/salary?month=${encodeURIComponent(targetMonth)}`, undefined, isAccountant);
      setReports(result.reports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load salary");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!role) return;
    if (isAccountant) {
      void loadPayrollAccess();
    }
    if (canReviewPayrollAccess) void loadApprovalRequests();
  }, [role]);

  useEffect(() => {
    if (!role) return;
    if (isAccountant && payrollAccess?.access !== "approved") return;
    void loadReports();
    setDateRange(monthRange(month));
  }, [month, payrollAccess?.access]);

  function applyDateRange(next: { from: string; to: string }) {
    setDateRange(next);
    const nextMonth = next.from ? next.from.slice(0, 7) : month;
    setMonth(nextMonth);
    void loadReports(nextMonth);
  }

  const generateSalary = async () => {
    if (isAccountant && payrollAccess?.access !== "approved") return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ reports: SalaryReport[]; message?: string }>("/api/admin/salary", {
        method: "POST",
        body: JSON.stringify({ month })
      }, isAccountant);
      setReports(result.reports);
      setMessage(result.message ?? "Salary generated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate salary");
    } finally {
      setLoading(false);
    }
  };

  const togglePaid = async (report: SalaryReport) => {
    if (isAccountant && payrollAccess?.access !== "approved") return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const nextPaid = !report.paid;
      const result = await apiRequest<{ message?: string }>("/api/admin/salary", {
        method: "PATCH",
        body: JSON.stringify({ month: report.month, teacherId: report.teacherId, paid: nextPaid })
      }, isAccountant);
      setReports((items) => items.map((item) => (item.teacherId === report.teacherId ? { ...item, paid: nextPaid, paidAt: nextPaid ? new Date().toISOString() : "" } : item)));
      setMessage(result.message ?? "Salary updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update salary");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (!reports.length) {
      setError("Generate salary first — nothing to export.");
      return;
    }
    // Load the spreadsheet library only when the user actually exports.
    const XLSX = await import("xlsx");
    const rows = reports.map((report) => ({
      "Teacher Name": report.teacherName,
      "Employee ID": report.employeeId,
      Month: report.month,
      "Base Salary": roundMoney(report.baseSalary),
      "Total Working Days": report.totalWorkingDaysInMonth ?? report.workingDays,
      "Working Days Elapsed": report.workingDaysElapsed ?? report.workingDays,
      "Present Days": report.presentDays,
      "Approved Paid CL Days": approvedPaidCLDays(report),
      "Unpaid Absent Days": unpaidAbsentDays(report),
      "Daily Rate": roundMoney(report.perDaySalary),
      Deduction: roundMoney(report.salaryDeduction),
      Bonus: roundMoney(report.bonus),
      "Net Payable": roundMoney(report.netPayable),
      "Absent Dates": report.absentDates?.join(", ") ?? "",
      "Present Dates": report.presentDates?.join(", ") ?? "",
      "Leave Requests": report.approvedLeaveInfo || "-",
      "Management Holidays": report.managementHolidayDays ?? 0,
      "Management Holiday Details": report.managementHolidayInfo || "-",
      Status: report.paid ? "Paid" : "Unpaid"
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 18 }, { wch: 20 },
      { wch: 12 }, { wch: 22 }, { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
      { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 20 }, { wch: 40 }, { wch: 10 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Salary ${month}`);
    XLSX.writeFile(workbook, `Salary-${month}.xlsx`);
    setMessage(`Exported ${reports.length} salary record${reports.length === 1 ? "" : "s"} to Excel.`);
  };

  const requestPayrollApproval = async () => {
    setAccessLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<PayrollAccessState>("/api/admin/payroll-access", {
        method: "POST",
        body: JSON.stringify({ reason: "Payroll access requested from salary screen" })
      }, true);
      setPayrollAccess(result);
      setMessage("Approval request sent to admin.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request approval");
    } finally {
      setAccessLoading(false);
    }
  };

  const reviewPayrollRequest = async (request: PayrollAccessRequest, action: "approve" | "reject") => {
    setApprovalLoading(true);
    setError(null);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/payroll-access/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ action })
      });
      setMessage(action === "approve" ? "Payroll access approved." : "Payroll access rejected.");
      await loadApprovalRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review payroll access");
    } finally {
      setApprovalLoading(false);
    }
  };

  if (isAccountant && payrollAccess?.access !== "approved") {
    return (
      <>
        <PageHeader title="Salary Management" description="Payroll requires admin approval for accountant sessions." />
        <section className="space-y-5 p-4 md:p-7">
          {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
          {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
          <div className="card max-w-2xl p-5 md:p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#fff4df] text-[#d79418]">
                <LockKeyhole size={24} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold text-[#1f2136]">Payroll locked</h2>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">
                  Accountant payroll access is locked until an admin approves this login session.
                </p>
                {payrollAccess?.status === "pending" && (
                  <div className="mt-4 rounded-xl border border-[#ffe1ab] bg-[#fff8ea] px-4 py-3 text-sm font-semibold text-[#9f7116]">
                    Request pending since {formatDateTime(payrollAccess.request?.requestedAt)}.
                  </div>
                )}
                {payrollAccess?.status === "rejected" && (
                  <div className="mt-4 rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">
                    The last request was rejected. You can request approval again.
                  </div>
                )}
                {payrollAccess?.request && (
                  <div className="mt-4 grid gap-2 text-xs font-semibold text-[#7d86a8] sm:grid-cols-2">
                    <span>School: {payrollAccess.request.schoolId ?? "--"}</span>
                    <span>Branch: {payrollAccess.request.branchId ?? "--"}</span>
                    <span>Academic year: {payrollAccess.request.academicYearId ?? "--"}</span>
                    <span>Date: {payrollAccess.request.dateKey ?? "--"}</span>
                  </div>
                )}
                <button className="btn-primary mt-5" onClick={requestPayrollApproval} disabled={accessLoading || payrollAccess?.status === "pending"}>
                  <AlertCircle size={16} /> {accessLoading ? "Requesting..." : "Request Admin Approval"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Salary Management" description="Generate salary from attendance, apply adjustments, and mark payment status." />
      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        {canReviewPayrollAccess && (
          <div className="card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-extrabold text-[#1f2136]">Accountant payroll approvals</h2>
                <p className="mt-1 text-sm font-medium text-[#7d86a8]">Approve access only for the accountant's current login session.</p>
              </div>
              <button className="btn-secondary" onClick={loadApprovalRequests} disabled={approvalLoading}>
                <RotateCw size={16} /> Refresh
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr>
                    <th className="px-4 py-3">Accountant</th>
                    <th className="px-4 py-3">Context</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalRequests.map((request) => (
                    <tr key={request.id} className="border-t border-stone-100">
                      <td className="px-4 py-3">
                        <span className="block font-bold text-[#303247]">{request.accountantName || request.accountantUserId}</span>
                        <span className="block text-xs font-medium text-[#7d86a8]">{request.accountantEmail || request.accountantUserId}</span>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-[#7d86a8]">
                        {request.schoolId ?? "--"} · {request.branchId ?? "--"} · {request.academicYearId ?? "--"} · {request.dateKey ?? "--"}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#7d86a8]">{formatDateTime(request.requestedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={request.status === "approved" ? "rounded-full bg-[#e6f8ef] px-3 py-1 text-xs font-extrabold text-[#0f8d52]" : request.status === "rejected" ? "rounded-full bg-[#ffebed] px-3 py-1 text-xs font-extrabold text-[#c83f4d]" : "rounded-full bg-[#fff8ea] px-3 py-1 text-xs font-extrabold text-[#9f7116]"}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button className="btn-secondary" onClick={() => void reviewPayrollRequest(request, "approve")} disabled={approvalLoading || request.status === "approved"}>
                            <Check size={15} /> Approve
                          </button>
                          <button className="btn-secondary" onClick={() => void reviewPayrollRequest(request, "reject")} disabled={approvalLoading || request.status === "rejected"}>
                            <X size={15} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!approvalRequests.length && (
                    <tr>
                      <td className="px-4 py-5 text-center text-sm font-medium text-[#7d86a8]" colSpan={5}>
                        {approvalLoading ? "Loading approval requests..." : "No payroll approval requests yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DateRangeFilter
          from={dateRange.from}
          to={dateRange.to}
          onChange={(next) => setDateRange(next)}
          onApply={applyDateRange}
          loading={loading}
          rightSlot={<span className="text-sm font-bold text-[#1f2136]">Payroll month: {month}</span>}
        />
        <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <button className="btn-primary" onClick={generateSalary} disabled={loading}>
            <RotateCw size={16} /> {loading ? "Working..." : "Generate monthly salary"}
          </button>
          <button className="btn-secondary" onClick={() => loadReports()} disabled={loading}>Refresh</button>
          <button className="btn-secondary md:ml-auto" onClick={exportToExcel} disabled={loading || !reports.length}>
            <Download size={16} /> Export Excel
          </button>
        </div>
        {/* Mobile: staff salary cards (the 12-column table is unreadable on phones) */}
        <div className="space-y-3 md:hidden">
          {reports.map((report) => (
            <div key={report.teacherId} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-[#1f2136]">{report.teacherName}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#7d86a8]">Base ₹{money(report.baseSalary)} · Daily ₹{money(report.perDaySalary)}</p>
                </div>
                <button className="btn-secondary shrink-0" disabled={loading} onClick={() => togglePaid(report)}>
                  <CheckCircle2 size={15} /> {report.paid ? "Paid" : "Mark paid"}
                </button>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8490b9]">Present Days</dt>
                  <dd className="text-sm font-bold text-[#303247]">{report.presentDays}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8490b9]">Paid CL</dt>
                  <dd className="text-sm font-bold text-[#303247]">{approvedPaidCLDays(report)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8490b9]">Unpaid Absent</dt>
                  <dd className={`text-sm font-bold ${unpaidAbsentDays(report) > 0 ? "text-[#ed515d]" : "text-[#13a961]"}`}>{unpaidAbsentDays(report)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8490b9]">Deduction</dt>
                  <dd className={`text-sm font-bold ${(report.salaryDeduction ?? 0) > 0 ? "text-red-600" : "text-[#303247]"}`}>₹{money(report.salaryDeduction)}</dd>
                </div>
                <div className="col-span-2 mt-1 rounded-xl bg-[#f7f8fd] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8490b9]">Net Payable</dt>
                  <dd className="text-xl font-extrabold text-[#1b1d32]">₹{money(report.netPayable)}</dd>
                </div>
              </dl>
            </div>
          ))}
          {!loading && reports.length === 0 && (
            <div className="card p-6 text-center text-sm font-medium text-[#7d86a8]">No salary reports yet. Click Generate monthly salary.</div>
          )}
        </div>

        {/* Desktop / tablet: full payroll table */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1220px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Base Salary</th>
                <th className="px-4 py-3">Total Working Days</th>
                <th className="px-4 py-3">Working Days Elapsed</th>
                <th className="px-4 py-3">Present Days</th>
                <th className="px-4 py-3">Approved Paid CL Days</th>
                <th className="px-4 py-3">Unpaid Absent Days</th>
                <th className="px-4 py-3">Daily Rate</th>
                <th className="px-4 py-3">Deduction</th>
                <th className="px-4 py-3">Bonus</th>
                <th className="px-4 py-3">Net Payable</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.teacherId} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium">{report.teacherName}</td>
                  <td className="px-4 py-3">₹{money(report.baseSalary)}</td>
                  <td className="px-4 py-3">{report.totalWorkingDaysInMonth ?? report.workingDays}</td>
                  <td className="px-4 py-3">{report.workingDaysElapsed ?? report.workingDays}</td>
                  <td className="px-4 py-3">{report.presentDays}</td>
                  <td className="px-4 py-3" title={report.approvedLeaveInfo || "No approved leave"}>
                    {approvedPaidCLDays(report)}
                    {report.attendedApprovedLeaveDays ? <span className="ml-1 text-xs text-[#7d86a8]">(+{report.attendedApprovedLeaveDays} worked)</span> : null}
                  </td>
                  <td className={`px-4 py-3 font-bold ${unpaidAbsentDays(report) > 0 ? "text-[#ed515d]" : "text-[#13a961]"}`}>
                    {unpaidAbsentDays(report)}
                  </td>
                  <td className="px-4 py-3 text-xs">₹{money(report.perDaySalary)}</td>
                  <td className={`px-4 py-3 font-semibold ${(report.salaryDeduction ?? 0) > 0 ? "text-red-600" : ""}`} title={`Plain absent: ${report.plainAbsentDays ?? 0} · Excess leave: ${report.excessCLDays ?? report.excessLeave ?? 0}`}>
                    ₹{money(report.salaryDeduction)}
                  </td>
                  <td className="px-4 py-3">₹{money(report.bonus)}</td>
                  <td className="px-4 py-3 font-semibold">₹{money(report.netPayable)}</td>
                  <td className="px-4 py-3">
                    <button className="btn-secondary" disabled={loading} onClick={() => togglePaid(report)}>
                      <CheckCircle2 size={15} /> {report.paid ? "Paid" : "Mark paid"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && reports.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm font-medium text-[#7d86a8]" colSpan={12}>No salary reports yet. Click Generate monthly salary.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <SalaryAdvancesPanel />
      </section>
    </>
  );
}
