"use client";

import { useAdminSession } from "@/components/AdminSessionContext";
import { PageHeader } from "@/components/PageHeader";
import { SalaryAdvancesPanel } from "@/components/SalaryAdvancesPanel";
import { auth } from "@sri-narayana/shared/firebase/client";
import {
  formatLabel,
  getApprovedPaidCLDays,
  getSalaryPaymentBlockedReason,
  getUnpaidAbsentDays,
  isSalaryPaymentBlocked,
  normalizeSalaryReport,
  type SalaryReport
} from "@sri-narayana/shared";
import {
  AlertCircle,
  Banknote,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Loader2,
  Percent,
  RotateCw,
  Settings,
  Users,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { payrollSessionHeaders } from "@/lib/payrollSessionClient";

type TabId = "payroll" | "pending" | "paid" | "advances" | "approvals" | "slips" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "payroll", label: "Payroll" },
  { id: "pending", label: "Pending Payments" },
  { id: "paid", label: "Paid Salaries" },
  { id: "advances", label: "Advances" },
  { id: "approvals", label: "Approvals" },
  { id: "slips", label: "Salary Slips" },
  { id: "settings", label: "Settings" }
];

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

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

function money(value?: number) {
  return (value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatDateTime(value?: string) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusConfig(report: SalaryReport) {
  if (report.paid) return { label: "Paid", bg: "bg-[#f0fdf4]", text: "text-[#16a34a]" };
  if (report.salaryStatus === "Attendance Missing") return { label: "Draft", bg: "bg-[#f1f5f9]", text: "text-[#64748b]" };
  if (report.salaryStatus === "Invalid") return { label: "Hold", bg: "bg-[#fef2f2]", text: "text-[#dc2626]" };
  if (report.salaryDeduction > 0 || report.bonus > 0) return { label: "Pending Approval", bg: "bg-[#fffbeb]", text: "text-[#d97706]" };
  return { label: "Generated", bg: "bg-[#eff6ff]", text: "text-[#2563eb]" };
}

export default function SalaryPage() {
  const { role } = useAdminSession();
  const isAccountant = role === "accountant";
  const canReviewPayrollAccess = role === "super_admin";
  const [month, setMonth] = useState(currentMonth());
  const [activeTab, setActiveTab] = useState<TabId>("payroll");
  const [reports, setReports] = useState<SalaryReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [payrollAccess, setPayrollAccess] = useState<PayrollAccessState | null>(null);
  const [approvalRequests, setApprovalRequests] = useState<PayrollAccessRequest[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingApprovalsRef = useRef(0);

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

  const loadReports = useCallback(async (targetMonth?: string) => {
    const m = targetMonth ?? month;
    if (isAccountant && payrollAccess?.access !== "approved") return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<{ reports: SalaryReport[] }>(
        `/api/admin/salary?month=${encodeURIComponent(m)}`, undefined, isAccountant
      );
      setReports(result.reports.map(normalizeSalaryReport));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load salary");
    } finally {
      setLoading(false);
    }
  }, [month, isAccountant, payrollAccess?.access]);

  const loadPayrollAccess = async () => {
    if (!isAccountant) {
      setPayrollAccess({ access: "direct" });
      return;
    }
    setAccessLoading(true);
    try {
      const result = await apiRequest<PayrollAccessState>("/api/admin/payroll-access", undefined, true);
      setPayrollAccess(result);
    } catch {
      setPayrollAccess({ access: "locked", status: "none" });
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
      pendingApprovalsRef.current = result.requests.filter((r) => r.status === "pending").length;
    } catch {
      // silent
    } finally {
      setApprovalLoading(false);
    }
  };

  useEffect(() => {
    if (!role) return;
    if (isAccountant) void loadPayrollAccess();
    if (canReviewPayrollAccess) void loadApprovalRequests();
  }, [role]);

  useEffect(() => {
    if (!role) return;
    if (isAccountant && payrollAccess?.access !== "approved") return;
    void loadReports();
  }, [month, payrollAccess?.access]);

  const summary = useMemo(() => {
    let staff = 0, gross = 0, deductions = 0, netPayable = 0, pending = 0;
    for (const r of reports) {
      staff++;
      gross += r.baseSalary + (r.bonus || 0);
      deductions += (r.salaryDeduction || 0);
      netPayable += r.netPayable;
      if (!r.paid) pending += r.netPayable;
    }
    return { staff, gross, deductions, netPayable, pending };
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (activeTab === "pending") return reports.filter((r) => !r.paid);
    if (activeTab === "paid") return reports.filter((r) => r.paid);
    return reports;
  }, [reports, activeTab]);

  const pendingApprovalsCount = approvalRequests.filter((r) => r.status === "pending").length;

  const isFutureMonth = useMemo(() => {
    const now = new Date();
    const [y, m] = month.split("-").map(Number);
    return y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth() + 1);
  }, [month]);

  const generateSalary = async () => {
    if (isAccountant && payrollAccess?.access !== "approved") return;
    setShowGenerateModal(false);
    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest<{ reports: SalaryReport[]; message?: string }>(
        "/api/admin/salary", { method: "POST", body: JSON.stringify({ month }) }, isAccountant
      );
      setReports(result.reports.map(normalizeSalaryReport));
      setMessage(result.message ?? "Salary generated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate salary");
    } finally {
      setGenerating(false);
    }
  };

  const togglePaid = async (report: SalaryReport) => {
    if (isAccountant && payrollAccess?.access !== "approved") return;
    if (!report.paid && isSalaryPaymentBlocked(report)) {
      setError(getSalaryPaymentBlockedReason(report) ?? "Salary payment is blocked.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const nextPaid = !report.paid;
      await apiRequest<{ message?: string }>(
        "/api/admin/salary", {
          method: "PATCH",
          body: JSON.stringify({ month: report.month, teacherId: report.teacherId, paid: nextPaid })
        }, isAccountant
      );
      setReports((items) => items.map((item) =>
        item.teacherId === report.teacherId ? { ...item, paid: nextPaid, paidAt: nextPaid ? new Date().toISOString() : "" } : item
      ));
      setMessage(nextPaid ? "Marked as paid." : "Marked as unpaid.");
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
      const result = await apiRequest<PayrollAccessState>(
        "/api/admin/payroll-access", { method: "POST", body: JSON.stringify({ reason: "Payroll access requested" }) }, true
      );
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
        method: "PATCH", body: JSON.stringify({ action })
      });
      setMessage(action === "approve" ? "Payroll access approved." : "Payroll access rejected.");
      await loadApprovalRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review");
    } finally {
      setApprovalLoading(false);
    }
  };

  if (isAccountant && payrollAccess?.access !== "approved") {
    return (
      <>
        <PageHeader title="Salary & Payroll" description="Payroll requires admin approval for accountant sessions." />
        <section className="space-y-5 p-4 md:p-7">
          {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
          {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
          <div className="max-w-2xl rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm md:p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#fff4df] text-[#d79418]"><Clock size={24} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold text-[#1e293b]">Payroll locked</h2>
                <p className="mt-1 text-sm font-medium text-[#64748b]">Accountant payroll access requires admin approval for this session.</p>
                {payrollAccess?.status === "pending" && (
                  <div className="mt-4 rounded-xl border border-[#ffe1ab] bg-[#fff8ea] px-4 py-3 text-sm font-semibold text-[#9f7116]">
                    Request pending since {formatDateTime(payrollAccess.request?.requestedAt)}.
                  </div>
                )}
                {payrollAccess?.status === "rejected" && (
                  <div className="mt-4 rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">
                    Last request was rejected. Request again.
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
      <PageHeader
        title="Salary & Payroll"
        description="Generate salary, review deductions, approve payments, and print salary slips."
      />

      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]"><Users size={20} /></span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Total Staff</p>
                <p className="text-xl font-extrabold text-[#1e293b]">{summary.staff}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#dcfce7] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f0fdf4] text-[#16a34a]"><Banknote size={20} /></span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Gross Salary</p>
                <p className="text-xl font-extrabold text-[#1e293b]">₹{money(summary.gross)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#fef3c7] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fffbeb] text-[#d97706]"><Percent size={20} /></span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Deductions</p>
                <p className="text-xl font-extrabold text-[#1e293b]">₹{money(summary.deductions)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#dbeafe] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eff6ff] text-[#2563eb]"><CheckCircle size={20} /></span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Net Payable</p>
                <p className="text-xl font-extrabold text-[#1e293b]">₹{money(summary.netPayable)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#fef2f2] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fef2f2] text-[#dc2626]"><Clock size={20} /></span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">Pending</p>
                <p className="text-xl font-extrabold text-[#1e293b]">₹{money(summary.pending)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Month Control + Generate */}
        <div className="flex flex-col gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#64748b]" />
              <input
                type="month"
                className="field w-44"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <span className="text-xs font-semibold text-[#64748b]">
              {monthLabel(month)}
            </span>
            {isFutureMonth && (
              <span className="rounded-full bg-[#fef2f2] px-2 py-0.5 text-xs font-bold text-[#dc2626]">
                Future month
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-secondary" onClick={() => loadReports()} disabled={loading}>
              <RotateCw size={15} /> Refresh
            </button>
            <button className="btn-secondary" disabled={loading || !reports.length}>
              <Download size={15} /> Export
            </button>
            <button className="btn-secondary">
              <Settings size={15} /> Settings
            </button>
            <button
              className="btn-primary"
              onClick={() => setShowGenerateModal(true)}
              disabled={generating || isFutureMonth}
              title={isFutureMonth ? "Cannot generate payroll for a future month." : ""}
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
              {generating ? "Generating..." : "Generate Monthly Salary"}
            </button>
          </div>
        </div>

        {/* Approval Alert */}
        {pendingApprovalsCount > 0 && (
          <div className="flex items-center justify-between rounded-2xl border border-[#fef3c7] bg-[#fffbeb] px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#d97706]">
              <AlertCircle size={16} />
              {pendingApprovalsCount} payroll approval request{pendingApprovalsCount > 1 ? "s" : ""} pending
            </div>
            <button className="btn-secondary text-xs" onClick={() => setActiveTab("approvals")}>
              Review
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#e2e8f0]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`whitespace-nowrap px-4 py-2.5 text-sm font-bold transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[#2563eb] text-[#2563eb]"
                  : "border-transparent text-[#64748b] hover:text-[#1e293b]"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {(tab.id === "pending" || tab.id === "payroll") && reports.filter((r) => tab.id === "pending" ? !r.paid : false).length > 0 && tab.id === "pending" && (
                <span className="ml-1.5 rounded-full bg-[#fef2f2] px-1.5 py-0.5 text-xs font-bold text-[#dc2626]">
                  {reports.filter((r) => !r.paid).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "advances" ? (
          <SalaryAdvancesPanel />
        ) : activeTab === "approvals" ? (
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-extrabold text-[#1e293b]">Accountant Payroll Approvals</h2>
              <button className="btn-secondary" onClick={loadApprovalRequests} disabled={approvalLoading}>
                <RotateCw size={15} /> Refresh
              </button>
            </div>
            {!canReviewPayrollAccess ? (
              <p className="text-sm font-medium text-[#64748b]">Only super admins can review payroll access requests.</p>
            ) : approvalRequests.length === 0 ? (
              <p className="text-sm font-medium text-[#64748b]">No payroll approval requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-sm">
                  <thead className="bg-[#f8fafc] text-xs font-bold uppercase text-[#64748b]">
                    <tr>
                      <th className="px-4 py-3">Accountant</th>
                      <th className="px-4 py-3">Context</th>
                      <th className="px-4 py-3">Requested</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approvalRequests.map((req) => (
                      <tr key={req.id} className="border-t border-[#f1f5f9]">
                        <td className="px-4 py-3">
                          <span className="block font-bold text-[#1e293b]">{req.accountantName || req.accountantUserId}</span>
                          <span className="block text-xs font-medium text-[#64748b]">{req.accountantEmail || ""}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-[#64748b]">
                          {[req.schoolId, req.branchId, req.academicYearId, req.dateKey].filter(Boolean).join(" · ")}
                        </td>
                        <td className="px-4 py-3 font-medium text-[#64748b]">{formatDateTime(req.requestedAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                            req.status === "approved" ? "bg-[#f0fdf4] text-[#16a34a]" :
                            req.status === "rejected" ? "bg-[#fef2f2] text-[#dc2626]" :
                            "bg-[#fffbeb] text-[#d97706]"
                          }`}>{formatLabel(req.status)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary" onClick={() => reviewPayrollRequest(req, "approve")}
                              disabled={approvalLoading || req.status === "approved"}>
                              <Check size={15} /> Approve
                            </button>
                            <button className="btn-secondary" onClick={() => reviewPayrollRequest(req, "reject")}
                              disabled={approvalLoading || req.status === "rejected"}>
                              <X size={15} /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : activeTab === "slips" || activeTab === "settings" ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-10 text-center shadow-sm">
            <FileText size={40} className="text-[#cbd5e1]" />
            <h3 className="text-base font-extrabold text-[#1e293b]">
              {activeTab === "slips" ? "Salary Slips" : "Payroll Settings"}
            </h3>
            <p className="text-sm font-medium text-[#64748b]">
              {activeTab === "slips" ? "Click on a staff member's Slip button to view their salary slip." : "Payroll settings are managed from the main Settings page."}
            </p>
          </div>
        ) : filteredReports.length === 0 && !loading ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-10 text-center shadow-sm">
            <FileText size={40} className="text-[#cbd5e1]" />
            <h3 className="text-base font-extrabold text-[#1e293b]">No salary generated for {monthLabel(month)}</h3>
            <p className="text-sm font-medium text-[#64748b]">Generate salary to view payroll records.</p>
            <button className="btn-primary mt-2" onClick={() => setShowGenerateModal(true)} disabled={isFutureMonth}>
              <RotateCw size={16} /> Generate Monthly Salary
            </button>
            {isFutureMonth && (
              <p className="text-xs font-semibold text-[#dc2626]">Cannot generate payroll for a future month.</p>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {filteredReports.map((report) => {
                const paidCL = getApprovedPaidCLDays(report);
                const unpaid = getUnpaidAbsentDays(report);
                const isExpanded = expandedId === report.teacherId;
                const status = statusConfig(report);
                return (
                  <div key={report.teacherId} className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-[#1e293b]">{report.teacherName}</p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[#64748b]">{report.subject || report.employeeId}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div><span className="font-semibold text-[#64748b]">Base:</span> <span className="font-bold">₹{money(report.baseSalary)}</span></div>
                      <div><span className="font-semibold text-[#64748b]">Net:</span> <span className="font-bold">₹{money(report.netPayable)}</span></div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
                      <span className="text-[#16a34a]">P: {report.presentDays}</span>
                      {paidCL > 0 && <span className="text-[#d97706]">CL: {paidCL}</span>}
                      {unpaid > 0 && <span className="text-[#dc2626]">A: {unpaid}</span>}
                      {report.lateEntries > 0 && <span className="text-[#64748b]">Late: {report.lateEntries}</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-secondary text-xs" onClick={() => setExpandedId(isExpanded ? null : report.teacherId)}>
                        {isExpanded ? "Hide" : "View"} Details
                      </button>
                      <button className="btn-secondary text-xs" disabled={loading} onClick={() => togglePaid(report)}>
                        <CheckCircle size={14} /> {report.paid ? "Paid" : "Mark Paid"}
                      </button>
                      <button className="btn-secondary text-xs">
                        <FileText size={14} /> Slip
                      </button>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 rounded-xl bg-[#f8fafc] p-3 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <span>Working days: <b>{report.totalWorkingDaysInMonth ?? report.workingDays}</b></span>
                          <span>Elapsed: <b>{report.workingDaysElapsed ?? report.workingDays}</b></span>
                          <span>Present: <b>{report.presentDays}</b></span>
                          <span>Paid CL: <b>{paidCL}</b></span>
                          <span>Unpaid absent: <b className="text-[#dc2626]">{unpaid}</b></span>
                          <span>Late entries: <b>{report.lateEntries}</b></span>
                          <span>Daily rate: <b>₹{money(report.perDaySalary)}</b></span>
                          <span>Deduction: <b className="text-[#dc2626]">₹{money(report.salaryDeduction)}</b></span>
                          <span>Bonus: <b className="text-[#16a34a]">₹{money(report.bonus)}</b></span>
                          <span>Net payable: <b>₹{money(report.netPayable)}</b></span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8fafc] text-xs font-bold uppercase text-[#64748b]">
                  <tr>
                    <th className="w-8 px-4 py-3"></th>
                    <th className="px-4 py-3">Staff</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Base Salary</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Deductions</th>
                    <th className="px-4 py-3">Advances</th>
                    <th className="px-4 py-3">Net Payable</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report) => {
                    const paidCL = getApprovedPaidCLDays(report);
                    const unpaid = getUnpaidAbsentDays(report);
                    const isExpanded = expandedId === report.teacherId;
                    const status = statusConfig(report);
                    const isBlocked = !report.paid && isSalaryPaymentBlocked(report);
                    return (
                      <tr key={report.teacherId} className="border-t border-[#f1f5f9]">
                        <td className="px-4 py-3">
                          <button
                            className="rounded p-1 hover:bg-[#f1f5f9]"
                            onClick={() => setExpandedId(isExpanded ? null : report.teacherId)}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#1e293b]">{report.teacherName}</p>
                          <p className="text-xs text-[#64748b]">{report.employeeId}</p>
                        </td>
                        <td className="px-4 py-3 text-[#64748b]">{report.subject || "--"}</td>
                        <td className="px-4 py-3 font-semibold">₹{money(report.baseSalary)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <span className="rounded-md bg-[#f0fdf4] px-2 py-0.5 font-bold text-[#16a34a]">P: {report.presentDays}</span>
                            {paidCL > 0 && (
                              <span className="rounded-md bg-[#fffbeb] px-2 py-0.5 font-bold text-[#d97706]">CL: {paidCL}</span>
                            )}
                            <span className={`rounded-md px-2 py-0.5 font-bold ${unpaid > 0 ? "bg-[#fef2f2] text-[#dc2626]" : "bg-[#f1f5f9] text-[#64748b]"}`}>
                              A: {unpaid}
                            </span>
                            {report.lateEntries > 0 && (
                              <span className="rounded-md bg-[#f1f5f9] px-2 py-0.5 font-bold text-[#64748b]">Late: {report.lateEntries}</span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-semibold ${report.salaryDeduction > 0 ? "text-[#dc2626]" : "text-[#64748b]"}`}>
                          ₹{money(report.salaryDeduction)}
                        </td>
                        <td className="px-4 py-3 text-[#64748b]">--</td>
                        <td className="px-4 py-3 font-extrabold text-[#1e293b]">₹{money(report.netPayable)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${status.bg} ${status.text}`}>
                            {status.label}
                          </span>
                          {isBlocked && (
                            <p className="mt-1 text-[11px] font-semibold text-[#dc2626]">
                              {report.salaryStatus === "Attendance Missing" ? "Missing data" : "Invalid calc"}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              className="btn-secondary text-xs"
                              onClick={() => setExpandedId(isExpanded ? null : report.teacherId)}
                            >
                              {isExpanded ? "Hide" : "View"}
                            </button>
                            <button
                              className="btn-secondary text-xs"
                              disabled={loading || isBlocked}
                              onClick={() => togglePaid(report)}
                            >
                              <CheckCircle size={13} /> {report.paid ? "Paid" : "Pay"}
                            </button>
                            <button className="btn-secondary text-xs">
                              <FileText size={13} /> Slip
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Expanded details */}
              {filteredReports.filter((r) => expandedId === r.teacherId).map((report) => {
                const paidCL = getApprovedPaidCLDays(report);
                const unpaid = getUnpaidAbsentDays(report);
                return (
                  <div key={`detail-${report.teacherId}`} className="border-t border-[#e2e8f0] bg-[#f8fafc] px-6 py-4">
                    <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Total Working Days</p>
                        <p className="font-bold text-[#1e293b]">{report.totalWorkingDaysInMonth ?? report.workingDays}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Elapsed Working Days</p>
                        <p className="font-bold text-[#1e293b]">{report.workingDaysElapsed ?? report.workingDays}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Present Days</p>
                        <p className="font-bold text-[#16a34a]">{report.presentDays}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Approved Paid Leave / CL</p>
                        <p className="font-bold text-[#d97706]">{paidCL}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Unpaid Absent Days</p>
                        <p className={`font-bold ${unpaid > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{unpaid}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Late Count</p>
                        <p className="font-bold text-[#1e293b]">{report.lateEntries}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Daily Rate</p>
                        <p className="font-bold text-[#1e293b]">₹{money(report.perDaySalary)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Attendance Deduction</p>
                        <p className={`font-bold ${report.salaryDeduction > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>
                          -₹{money(report.salaryDeduction)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Bonus</p>
                        <p className="font-bold text-[#16a34a]">+₹{money(report.bonus)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Advance Deduction</p>
                        <p className="font-bold text-[#64748b]">₹0</p>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-2">
                        <p className="text-[11px] font-semibold uppercase text-[#64748b]">Final Net Payable</p>
                        <p className="text-2xl font-extrabold text-[#1e293b]">₹{money(report.netPayable)}</p>
                      </div>
                    </div>
                    {report.absentDates && report.absentDates.length > 0 && (
                      <p className="mt-3 text-xs font-medium text-[#64748b]">
                        Absent dates: {report.absentDates.join(", ")}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Generate Salary Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#e2e8f0] bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-[#1e293b]">Generate Salary for {monthLabel(month)}?</h2>
              <button className="rounded p-1 hover:bg-[#f1f5f9]" onClick={() => setShowGenerateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 rounded-xl bg-[#f8fafc] p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#64748b]">Active staff members</span>
                <span className="font-bold">{reports.length || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748b]">Total working days (month)</span>
                <span className="font-bold">{reports[0]?.totalWorkingDaysInMonth || "—"} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748b]">Elapsed working days</span>
                <span className="font-bold">{reports[0]?.workingDaysElapsed || "—"} days</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748b]">Holidays excluded</span>
                <span className="font-bold">{reports[0]?.holidays || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#64748b]">Existing records</span>
                <span className="font-bold">{reports.filter((r) => r.salaryStatus !== "Attendance Missing").length || "—"}</span>
              </div>
              <hr className="border-[#e2e8f0]" />
              <div className="space-y-1">
                <p className="flex items-center gap-2 text-xs font-medium text-[#16a34a]">
                  <CheckCircle size={14} /> Future days will not be counted as absent
                </p>
                <p className="flex items-center gap-2 text-xs font-medium text-[#64748b]">
                  <CheckCircle size={14} /> Only working days up to today are considered
                </p>
                <p className="flex items-center gap-2 text-xs font-medium text-[#64748b]">
                  <CheckCircle size={14} /> Existing generated salaries will not be duplicated
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button className="btn-secondary" onClick={() => setShowGenerateModal(false)}>Cancel</button>
              <button
                className="btn-primary"
                onClick={generateSalary}
                disabled={generating}
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
                {generating ? "Generating..." : "Generate Salary"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
