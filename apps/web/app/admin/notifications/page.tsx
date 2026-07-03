"use client";

import { PageHeader } from "@/components/PageHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import {
  demoAttendanceEditAudits,
  demoLeaveRequests,
  demoPasswordResetHistory,
  demoPasswordResetRequests,
  type AttendanceEditAudit,
  type LeaveRequest,
  type PasswordResetHistory,
  type PasswordResetRequest
} from "@sri-narayana/shared";
import { BellRing, CheckCircle2, ClipboardCheck, KeyRound, XCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

type NotificationPayload = {
  passwordRequests: PasswordResetRequest[];
  leaveRequests: LeaveRequest[];
  passwordResetHistory: PasswordResetHistory[];
  attendanceEditAudits: AttendanceEditAudit[];
};

type ResetForm = {
  password: string;
  confirmPassword: string;
  adminNote: string;
};

const emptyResetForm: ResetForm = {
  password: "",
  confirmPassword: "",
  adminNote: ""
};

function statusClass(status: string) {
  if (status === "open" || status === "pending") return "bg-[#fff4df] text-[#d79418]";
  if (status === "resolved" || status === "approved") return "bg-[#e6f8ef] text-[#13a961]";
  return "bg-[#ffebed] text-[#ed515d]";
}

export default function NotificationsPage() {
  const [passwordRequests, setPasswordRequests] = useState<PasswordResetRequest[]>(
    isFirebaseConfigured ? [] : demoPasswordResetRequests
  );
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(isFirebaseConfigured ? [] : demoLeaveRequests);
  const [passwordResetHistory, setPasswordResetHistory] = useState<PasswordResetHistory[]>(
    isFirebaseConfigured ? [] : demoPasswordResetHistory
  );
  const [attendanceEditAudits, setAttendanceEditAudits] = useState<AttendanceEditAudit[]>(
    isFirebaseConfigured ? [] : demoAttendanceEditAudits
  );
  const [selectedResetRequest, setSelectedResetRequest] = useState<PasswordResetRequest | null>(null);
  const [resetForm, setResetForm] = useState<ResetForm>(emptyResetForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = useMemo(
    () =>
      passwordRequests.filter((request) => request.status === "open").length +
      leaveRequests.filter((request) => request.status === "pending").length,
    [leaveRequests, passwordRequests]
  );

  const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please sign in as admin again.");
    const response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });
    const result = await response.json();
    if (!response.ok || result.ok === false) throw new Error(result.error ?? "Request failed");
    return result;
  };

  const loadNotifications = async () => {
    if (!isFirebaseConfigured) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequest<NotificationPayload>("/api/admin/notifications");
      setPasswordRequests(result.passwordRequests);
      setLeaveRequests(result.leaveRequests);
      setPasswordResetHistory(result.passwordResetHistory);
      setAttendanceEditAudits(result.attendanceEditAudits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const reviewLeave = async (requestId: string | undefined, status: "approved" | "rejected") => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        setLeaveRequests((requests) =>
          requests.map((request) => (request.id === requestId ? { ...request, status } : request))
        );
        setMessage(`Demo leave request ${status}.`);
        return;
      }
      const result = await apiRequest<{ message?: string }>("/api/admin/leave-requests", {
        method: "PATCH",
        body: JSON.stringify({ requestId, status })
      });
      setMessage(result.message ?? `Leave request ${status}.`);
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update leave request");
    } finally {
      setLoading(false);
    }
  };

  const rejectPasswordRequest = async (requestId: string | undefined) => {
    if (!requestId) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        setPasswordRequests((requests) =>
          requests.map((request) => (request.id === requestId ? { ...request, status: "rejected" } : request))
        );
        setMessage("Demo password request rejected.");
        return;
      }
      await apiRequest("/api/admin/password-reset-requests", {
        method: "PATCH",
        body: JSON.stringify({ requestId, status: "rejected", adminNote: "Rejected by admin" })
      });
      setMessage("Password request rejected.");
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reject password request");
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedResetRequest?.teacherId) {
      setError("This request is not linked to a teacher profile.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!isFirebaseConfigured) {
        setPasswordRequests((requests) =>
          requests.map((request) =>
            request.id === selectedResetRequest.id ? { ...request, status: "resolved" } : request
          )
        );
        setPasswordResetHistory((history) => [
          {
            id: `demo_reset_${Date.now()}`,
            teacherId: selectedResetRequest.teacherId ?? "",
            teacherName: selectedResetRequest.teacherName ?? "",
            employeeId: selectedResetRequest.employeeId ?? selectedResetRequest.loginId,
            resetBy: "admin_demo",
            resetAt: new Date().toISOString(),
            requestId: selectedResetRequest.id,
            note: resetForm.adminNote
          },
          ...history
        ]);
        setSelectedResetRequest(null);
        setResetForm(emptyResetForm);
        setMessage("Demo password request resolved.");
        return;
      }

      const result = await apiRequest<{ message?: string }>(
        `/api/admin/teachers/${selectedResetRequest.teacherId}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({
            ...resetForm,
            requestId: selectedResetRequest.id
          })
        }
      );
      setSelectedResetRequest(null);
      setResetForm(emptyResetForm);
      setMessage(result.message ?? "Password reset and request resolved.");
      await loadNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Review password reset requests, leave requests, password reset history, and attendance edit audit logs."
        action={
          <button className="btn-secondary" onClick={loadNotifications} disabled={loading}>
            <BellRing size={16} /> {loading ? "Refreshing..." : `${pendingCount} pending`}
          </button>
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {message && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">{message}</div>}
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        {selectedResetRequest && (
          <form onSubmit={submitPasswordReset} className="card p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-[#1f2136]">Reset teacher password</h2>
                <p className="text-sm font-medium text-[#7d86a8]">
                  {selectedResetRequest.teacherName || selectedResetRequest.loginId} · {selectedResetRequest.employeeId || selectedResetRequest.loginId}
                </p>
              </div>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb] hover:text-[#3033a1]" onClick={() => setSelectedResetRequest(null)}>
                <XCircle size={18} />
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <PasswordInput placeholder="New password" value={resetForm.password} onChange={(event) => setResetForm({ ...resetForm, password: event.target.value })} required />
              <PasswordInput placeholder="Confirm password" value={resetForm.confirmPassword} onChange={(event) => setResetForm({ ...resetForm, confirmPassword: event.target.value })} required />
              <input className="field" placeholder="Admin note" value={resetForm.adminNote} onChange={(event) => setResetForm({ ...resetForm, adminNote: event.target.value })} />
            </div>
            <button className="btn-primary mt-4" disabled={loading}>
              <KeyRound size={16} /> Reset and resolve
            </button>
          </form>
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card p-4">
            <div className="mb-4 flex items-center gap-2 font-semibold">
              <KeyRound size={18} /> Password reset requests
            </div>
            <div className="space-y-3">
              {passwordRequests.map((request) => (
                <div key={request.id ?? request.loginId} className="rounded-xl border border-[#e3e6f0] bg-[#fafbff] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#303247]">{request.teacherName || request.loginId}</p>
                      <p className="text-sm font-medium text-[#7d86a8]">{request.employeeId || request.loginId} · {request.requestedAt ? new Date(request.requestedAt).toLocaleString() : "--"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(request.status)}`}>{request.status}</span>
                  </div>
                  {request.status === "open" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-primary" onClick={() => setSelectedResetRequest(request)} disabled={!request.teacherId || loading}>
                        <KeyRound size={15} /> Reset password
                      </button>
                      <button className="btn-secondary" onClick={() => rejectPasswordRequest(request.id)} disabled={loading}>
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!passwordRequests.length && <p className="text-sm font-medium text-[#7d86a8]">No password requests.</p>}
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-4 flex items-center gap-2 font-semibold">
              <ClipboardCheck size={18} /> Leave requests
            </div>
            <div className="space-y-3">
              {leaveRequests.map((request) => (
                <div key={request.id ?? `${request.teacherId}_${request.startDate}`} className="rounded-xl border border-[#e3e6f0] bg-[#fafbff] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-[#303247]">{request.teacherName}</p>
                      <p className="text-sm font-medium text-[#7d86a8]">{request.startDate} to {request.endDate}</p>
                      <p className="mt-1 text-sm font-medium text-[#5f6888]">{request.reason}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(request.status)}`}>{request.status}</span>
                  </div>
                  {request.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="btn-primary" onClick={() => reviewLeave(request.id, "approved")} disabled={loading}>
                        <CheckCircle2 size={15} /> Approve
                      </button>
                      <button className="btn-secondary" onClick={() => reviewLeave(request.id, "rejected")} disabled={loading}>
                        <XCircle size={15} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!leaveRequests.length && <p className="text-sm font-medium text-[#7d86a8]">No leave requests.</p>}
            </div>
          </div>
        </div>

        {/* Audit/history tables — desktop detail, hidden on the focused mobile view */}
        <div className="hidden gap-4 md:grid xl:grid-cols-2">
          <div className="card overflow-hidden">
            <div className="border-b border-stone-100 px-4 py-3 font-semibold">Password reset history</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Employee ID</th><th className="px-4 py-3">Reset at</th><th className="px-4 py-3">Admin</th></tr>
                </thead>
                <tbody>
                  {passwordResetHistory.map((item) => (
                    <tr key={item.id ?? `${item.teacherId}_${item.resetAt}`} className="border-t border-stone-100">
                      <td className="px-4 py-3 font-medium">{item.teacherName}</td>
                      <td className="px-4 py-3">{item.employeeId}</td>
                      <td className="px-4 py-3">{new Date(item.resetAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{item.resetBy}</td>
                    </tr>
                  ))}
                  {!passwordResetHistory.length && <tr><td className="px-4 py-6 text-center text-stone-500" colSpan={4}>No password reset history.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-stone-100 px-4 py-3 font-semibold">Attendance edit audit</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Teacher ID</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th></tr>
                </thead>
                <tbody>
                  {attendanceEditAudits.map((item) => (
                    <tr key={item.id ?? `${item.attendanceId}_${item.editedAt}`} className="border-t border-stone-100">
                      <td className="px-4 py-3">{item.date}</td>
                      <td className="px-4 py-3">{item.teacherId}</td>
                      <td className="px-4 py-3">{item.previousStatus ? `${item.previousStatus} -> ${item.newStatus}` : item.newStatus}</td>
                      <td className="px-4 py-3">{item.reason}</td>
                    </tr>
                  ))}
                  {!attendanceEditAudits.length && <tr><td className="px-4 py-6 text-center text-stone-500" colSpan={4}>No attendance edit audits.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
