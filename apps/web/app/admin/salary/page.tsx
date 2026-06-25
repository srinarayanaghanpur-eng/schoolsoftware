"use client";

import { useAdminSession } from "@/components/AdminSessionContext";
import { PageHeader } from "@/components/PageHeader";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import {
  DEFAULT_SETTINGS,
  calculateMonthlySalary,
  demoAttendance,
  demoHolidays,
  demoTeachers,
  type SalaryReport
} from "@sri-narayana/shared";
import { AlertCircle, Check, CheckCircle2, LockKeyhole, RotateCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { payrollSessionHeaders } from "@/lib/payrollSessionClient";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function demoReportsForMonth(month: string) {
  return demoTeachers.map((teacher) =>
    calculateMonthlySalary({
      teacher,
      records: demoAttendance.filter((record) => record.teacherId === teacher.id && record.month === month),
      holidays: demoHolidays.filter((holiday) => holiday.date.startsWith(month)),
      month,
      settings: DEFAULT_SETTINGS
    })
  );
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

export default function SalaryPage() {
  const { role } = useAdminSession();
  const isAccountant = role === "accountant";
  const canReviewPayrollAccess = role === "super_admin" || role === "admin";
  const [month, setMonth] = useState(currentMonth());
  const [reports, setReports] = useState<SalaryReport[]>(() => (isFirebaseConfigured ? [] : demoReportsForMonth(currentMonth())));
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
    if (!isFirebaseConfigured || !isAccountant) {
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
    if (!isFirebaseConfigured || !canReviewPayrollAccess) return;
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

  const loadReports = async () => {
    if (isAccountant && payrollAccess?.access !== "approved") return;
    setLoading(true);
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        setReports(demoReportsForMonth(month));
        setMessage("Showing demo salary reports.");
        return;
      }
      const result = await apiRequest<{ reports: SalaryReport[] }>(`/api/admin/salary?month=${encodeURIComponent(month)}`, undefined, isAccountant);
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
  }, [month, payrollAccess?.access]);

  const generateSalary = async () => {
    if (isAccountant && payrollAccess?.access !== "approved") return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        setReports(demoReportsForMonth(month));
        setMessage("Demo salary generated.");
        return;
      }
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
      if (!isFirebaseConfigured) {
        setReports((items) =>
          items.map((item) =>
            item.teacherId === report.teacherId ? { ...item, paid: nextPaid, paidAt: nextPaid ? new Date().toISOString() : "" } : item
          )
        );
        setMessage(nextPaid ? "Demo salary marked as paid." : "Demo salary marked as unpaid.");
        return;
      }
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
        <div className="card flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <input className="field max-w-xs" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          <button className="btn-primary" onClick={generateSalary} disabled={loading}>
            <RotateCw size={16} /> {loading ? "Working..." : "Generate monthly salary"}
          </button>
          <button className="btn-secondary" onClick={loadReports} disabled={loading}>Refresh</button>
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Teacher</th>
                <th className="px-4 py-3">Working</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Late</th>
                <th className="px-4 py-3">Absent</th>
                <th className="px-4 py-3">CL Used</th>
                <th className="px-4 py-3">CL Balance</th>
                <th className="px-4 py-3">Excess</th>
                <th className="px-4 py-3">Daily Rate</th>
                <th className="px-4 py-3">Deduction</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">Net Payable</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.teacherId} className="border-t border-stone-100">
                  <td className="px-4 py-3 font-medium">{report.teacherName}</td>
                  <td className="px-4 py-3">{report.workingDays}</td>
                  <td className="px-4 py-3">{report.presentDays}</td>
                  <td className="px-4 py-3">{report.lateEntries}</td>
                  <td className="px-4 py-3">{report.absentDays}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs">
                      {report.clUsedFromAbsent}a + {report.clUsedFromLate}l = {report.totalClUsed}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-bold ${report.remainingCl === 0 ? "text-[#ed515d]" : "text-[#13a961]"}`}>
                    {report.remainingCl}/3
                  </td>
                  <td className={`px-4 py-3 font-bold ${report.excessLeave > 0 ? "text-[#ed515d]" : "text-[#13a961]"}`}>
                    {report.excessLeave}
                  </td>
                  <td className="px-4 py-3 text-xs">₹{(report.perDaySalary ?? 0).toLocaleString("en-IN")}</td>
                  <td className={`px-4 py-3 font-semibold ${(report.excessLeaveDeduction ?? 0) > 0 ? "text-red-600" : ""}`}>
                    ₹{(report.excessLeaveDeduction ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">₹{(report.baseSalary ?? 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold">₹{(report.netPayable ?? 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">
                    <button className="btn-secondary" disabled={loading} onClick={() => togglePaid(report)}>
                      <CheckCircle2 size={15} /> {report.paid ? "Paid" : "Mark paid"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && reports.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm font-medium text-[#7d86a8]" colSpan={13}>No salary reports yet. Click Generate monthly salary.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
