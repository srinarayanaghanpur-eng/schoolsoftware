"use client";

import { PageHeader } from "@/components/PageHeader";
import { PasswordInput } from "@/components/PasswordInput";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { useRefreshOnFocus } from "@/lib/useRefreshOnFocus";
import {
  Archive,
  ArchiveRestore,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  KeyRound,
  Trash2,
  XCircle
} from "lucide-react";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type RequestType = "password_reset" | "leave" | "attendance_edit";
type NormalizedStatus = "pending" | "approved" | "rejected" | "log";

type CommRequest = {
  id: string;
  type: RequestType;
  name: string;
  roleOrClass: string;
  createdAt: string;
  status: NormalizedStatus;
  message: string;
  archived: boolean;
  deletedAt: string | null;
  teacherId?: string;
  userId?: string;
  userRole?: string;
  targetType?: string;
  loginId?: string;
  employeeId?: string;
};

type Tab = "pending" | "approved" | "rejected" | "archived" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "archived", label: "Archived" },
  { key: "all", label: "All" }
];

const TYPE_LABEL: Record<RequestType, string> = {
  password_reset: "Password Reset",
  leave: "Leave",
  attendance_edit: "Attendance Edit"
};

const PAGE_SIZE = 25;
const COMMUNICATION_BADGE_COUNT_EVENT = "snhs-communication-pending-count";

function rowKey(request: CommRequest) {
  return `${request.type}:${request.id}`;
}

function statusBadge(request: CommRequest) {
  if (request.archived) return "bg-[#eef0f5] text-[#6b7391]";
  if (request.status === "pending") return "bg-[#fff4df] text-[#d79418]";
  if (request.status === "approved") return "bg-[#e6f8ef] text-[#13a961]";
  if (request.status === "rejected") return "bg-[#ffebed] text-[#ed515d]";
  return "bg-[#eef2ff] text-[#5a63c4]";
}

function statusLabel(request: CommRequest) {
  if (request.archived) return "archived";
  if (request.status === "log") return "log";
  return request.status;
}

function formatDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

type ResetForm = { password: string; confirmPassword: string; adminNote: string };
const emptyResetForm: ResetForm = { password: "", confirmPassword: "", adminNote: "" };

export default function NotificationsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  // Filter bar was removed from this page; requests always load unfiltered.
  const typeFilter: RequestType | "all" = "all";
  const startDate = "";
  const endDate = "";
  const search = "";

  const [requests, setRequests] = useState<CommRequest[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmState, setConfirmState] = useState<null | { text: string; onConfirm: () => void }>(null);
  const [details, setDetails] = useState<CommRequest | null>(null);
  const [resetTarget, setResetTarget] = useState<CommRequest | null>(null);
  const [resetForm, setResetForm] = useState<ResetForm>(emptyResetForm);

  const notify = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const buildQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({ status: tab, type: typeFilter, pageSize: String(PAGE_SIZE) });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (search) params.set("search", search);
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [tab, typeFilter, startDate, endDate, search]
  );

  const fetchRequests = useCallback(
    async (options: { append?: boolean; cursor?: string | null } = {}) => {
      setLoading(true);
      try {
        const data = await adminApiRequest<{ ok: boolean; requests: CommRequest[]; nextCursor: string | null; hasMore: boolean }>(
          `/api/admin/communication/requests?${buildQuery(options.cursor)}`
        );
        setRequests((prev) => (options.append ? [...prev, ...data.requests] : data.requests));
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
        if (!options.append) setSelected(new Set());
      } catch (err) {
        notify("err", err instanceof AdminApiError ? err.message : "Unable to load requests.");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, notify]
  );

  const fetchPendingCount = useCallback(async () => {
    try {
      const data = await adminApiRequest<{ ok: boolean; pendingCount: number }>("/api/admin/communication/requests?count=1");
      setPendingCount(data.pendingCount);
      window.dispatchEvent(new CustomEvent(COMMUNICATION_BADGE_COUNT_EVENT, { detail: { pendingCount: data.pendingCount } }));
    } catch {
      setPendingCount(null);
    }
  }, []);

  useEffect(() => {
    void fetchRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, typeFilter, startDate, endDate, search]);

  useEffect(() => {
    void fetchPendingCount();
  }, [fetchPendingCount]);

  useRefreshOnFocus(() => {
    void fetchRequests();
    void fetchPendingCount();
  });

  const runAction = useCallback(
    async (request: CommRequest, action: "approve" | "reject" | "archive" | "restore") => {
      setBusy(true);
      try {
        const result = await adminApiRequest<{ message?: string }>(`/api/admin/communication/requests/${request.id}`, {
          method: "PATCH",
          body: JSON.stringify({ type: request.type, action })
        });
        notify("ok", result.message ?? "Done.");
        await Promise.all([fetchRequests(), fetchPendingCount()]);
      } catch (err) {
        notify("err", err instanceof AdminApiError ? err.message : "Action failed.");
      } finally {
        setBusy(false);
      }
    },
    [fetchRequests, fetchPendingCount, notify]
  );

  const runBulk = useCallback(
    async (action: "archive" | "delete" | "clearRejected" | "clearApprovedOld") => {
      setBusy(true);
      try {
        const body: Record<string, unknown> = { action };
        if (action === "archive" || action === "delete") {
          const items = requests.filter((r) => selected.has(rowKey(r))).map((r) => ({ id: r.id, type: r.type }));
          if (items.length === 0) {
            notify("err", "Select at least one row.");
            setBusy(false);
            return;
          }
          body.items = items;
        }
        if (action === "clearApprovedOld") body.olderThanDays = 30;
        const result = await adminApiRequest<{ message?: string }>("/api/admin/communication/requests/bulk", {
          method: "POST",
          body: JSON.stringify(body)
        });
        notify("ok", result.message ?? "Done.");
        await Promise.all([fetchRequests(), fetchPendingCount()]);
      } catch (err) {
        notify("err", err instanceof AdminApiError ? err.message : "Bulk action failed.");
      } finally {
        setBusy(false);
      }
    },
    [requests, selected, fetchRequests, fetchPendingCount, notify]
  );

  const submitPasswordReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetTarget?.id) {
      notify("err", "This password request is missing its request ID.");
      return;
    }
    setBusy(true);
    try {
      const result = await adminApiRequest<{ message?: string }>(`/api/admin/password-reset-requests/${resetTarget.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify(resetForm)
      });
      setResetTarget(null);
      setResetForm(emptyResetForm);
      notify("ok", result.message ?? "Password reset and request resolved.");
      await Promise.all([fetchRequests(), fetchPendingCount()]);
    } catch (err) {
      notify("err", err instanceof AdminApiError ? err.message : "Unable to reset password.");
    } finally {
      setBusy(false);
    }
  };

  const allVisibleSelected = requests.length > 0 && requests.every((r) => selected.has(rowKey(r)));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(prev);
      requests.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  };
  const toggleOne = (request: CommRequest) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = rowKey(request);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedCount = useMemo(() => requests.filter((r) => selected.has(rowKey(r))).length, [requests, selected]);

  return (
    <>
      <PageHeader
        title="Communication"
        description="Password reset requests, leave requests, and attendance edit audit logs."
        action={
          <button className="btn-secondary" onClick={() => { void fetchRequests(); void fetchPendingCount(); }} disabled={loading}>
            <BellRing size={16} /> {pendingCount === null ? "Refresh" : `${pendingCount} pending`}
          </button>
        }
      />

      <section className="space-y-4 p-4 md:p-7">
        {toast && (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              toast.kind === "ok"
                ? "border-[#c8f0dc] bg-[#e6f8ef] text-[#0f8d52]"
                : "border-[#ffd5da] bg-[#ffebed] text-[#c83f4d]"
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                tab === t.key ? "bg-[#2d3094] text-white shadow-sm" : "bg-white text-[#475067] ring-1 ring-[#e3e6f0] hover:bg-[#f3f4fb]"
              }`}
            >
              {t.label}
              {t.key === "pending" && pendingCount ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>

        <p className="text-xs font-medium text-[#8a91b4]">
          Auto-cleanup: archived requests are permanently deleted after 5 days; approved/rejected requests auto-delete after 10 days. Audit logs are never auto-deleted.
        </p>

        {/* Bulk actions */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#6b7391]">{selectedCount} selected</span>
          <button type="button" className="btn-secondary" onClick={() => void runBulk("archive")} disabled={busy || selectedCount === 0}>
            <Archive size={15} /> Archive selected
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setConfirmState({
                text: `Remove ${selectedCount} selected request(s) from the list?`,
                onConfirm: () => { setConfirmState(null); void runBulk("delete"); }
              })
            }
            disabled={busy || selectedCount === 0}
          >
            <Trash2 size={15} /> Delete selected
          </button>
          <div className="mx-1 h-6 w-px bg-[#e3e6f0]" />
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setConfirmState({ text: "Archive ALL rejected requests?", onConfirm: () => { setConfirmState(null); void runBulk("clearRejected"); } })
            }
            disabled={busy}
          >
            Clear rejected
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() =>
              setConfirmState({
                text: "Archive all approved requests older than 30 days?",
                onConfirm: () => { setConfirmState(null); void runBulk("clearApprovedOld"); }
              })
            }
            disabled={busy}
          >
            Clear approved &gt; 30d
          </button>
        </div>

        {/* Desktop table */}
        <div className="card hidden overflow-hidden md:block">
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f7f8fd] text-xs uppercase tracking-[0.03em] text-[#6f7898]">
                <tr>
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} aria-label="Select all visible" />
                  </th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Role / Class</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && requests.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={`skeleton-${i}`} className="border-t border-[#edf0f7]">
                        <td className="px-4 py-3" colSpan={8}>
                          <div className="h-5 w-full animate-pulse rounded bg-[#eef0f7]" />
                        </td>
                      </tr>
                    ))
                  : requests.map((request) => (
                      <tr key={rowKey(request)} className="border-t border-[#edf0f7] align-top hover:bg-[#fafbff]">
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={selected.has(rowKey(request))} onChange={() => toggleOne(request)} aria-label="Select row" />
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#303247]">{TYPE_LABEL[request.type]}</td>
                        <td className="px-4 py-3 font-medium text-[#303247]">{request.name}</td>
                        <td className="px-4 py-3 text-[#7d86a8]">{request.roleOrClass}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-[#7d86a8]">{formatDate(request.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusBadge(request)}`}>{statusLabel(request)}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[260px] truncate text-[#5f6888]" title={request.message}>{request.message || "--"}</td>
                        <td className="px-4 py-3">
                          <RowActions
                            request={request}
                            busy={busy}
                            onApprove={() => void runAction(request, "approve")}
                            onReject={() => void runAction(request, "reject")}
                            onReset={() => { setResetTarget(request); setResetForm(emptyResetForm); }}
                            onArchive={() => void runAction(request, "archive")}
                            onRestore={() => void runAction(request, "restore")}
                            onView={() => setDetails(request)}
                          />
                        </td>
                      </tr>
                    ))}
                {!loading && requests.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm font-medium text-[#7d86a8]" colSpan={8}>
                      No {tab === "all" ? "" : tab} requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile compact cards */}
        <div className="space-y-2 md:hidden">
          {loading && requests.length === 0 && (
            <div className="card p-4"><div className="h-16 w-full animate-pulse rounded bg-[#eef0f7]" /></div>
          )}
          {!loading && requests.length === 0 && (
            <div className="card py-8 text-center text-sm font-medium text-[#7d86a8]">No {tab === "all" ? "" : tab} requests.</div>
          )}
          {requests.map((request) => (
            <div key={rowKey(request)} className="card p-3">
              <div className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={selected.has(rowKey(request))} onChange={() => toggleOne(request)} aria-label="Select row" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-[#303247]">{request.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${statusBadge(request)}`}>{statusLabel(request)}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-[#7d86a8]">{TYPE_LABEL[request.type]} · {request.roleOrClass} · {formatDate(request.createdAt)}</p>
                  {request.message && <p className="mt-1 line-clamp-2 text-xs text-[#5f6888]">{request.message}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <RowActions
                      request={request}
                      busy={busy}
                      compact
                      onApprove={() => void runAction(request, "approve")}
                      onReject={() => void runAction(request, "reject")}
                      onReset={() => { setResetTarget(request); setResetForm(emptyResetForm); }}
                      onArchive={() => void runAction(request, "archive")}
                      onRestore={() => void runAction(request, "restore")}
                      onView={() => setDetails(request)}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="text-center">
            <button type="button" className="btn-secondary" onClick={() => void fetchRequests({ append: true, cursor: nextCursor })} disabled={loading || !nextCursor}>
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </section>

      {/* Password reset modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setResetTarget(null)}>
          <form onSubmit={submitPasswordReset} className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-[#1f2136]">Reset account password</h2>
                <p className="text-sm font-medium text-[#7d86a8]">{resetTarget.name} · {resetTarget.employeeId || resetTarget.loginId || resetTarget.userId || resetTarget.teacherId}</p>
              </div>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" onClick={() => setResetTarget(null)}>
                <XCircle size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <PasswordInput placeholder="New password" value={resetForm.password} onChange={(e) => setResetForm({ ...resetForm, password: e.target.value })} required />
              <PasswordInput placeholder="Confirm password" value={resetForm.confirmPassword} onChange={(e) => setResetForm({ ...resetForm, confirmPassword: e.target.value })} required />
              <input className="field" placeholder="Admin note" value={resetForm.adminNote} onChange={(e) => setResetForm({ ...resetForm, adminNote: e.target.value })} />
            </div>
            <button className="btn-primary mt-4" disabled={busy}>
              <KeyRound size={16} /> Reset and resolve
            </button>
          </form>
        </div>
      )}

      {/* Details modal */}
      {details && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setDetails(null)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-bold text-[#1f2136]">{TYPE_LABEL[details.type]} request</h2>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl text-[#7d86a8] hover:bg-[#f4f5fb]" onClick={() => setDetails(null)}>
                <XCircle size={18} />
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <DetailRow label="Name" value={details.name} />
              <DetailRow label="Role / Class" value={details.roleOrClass} />
              <DetailRow label="Status" value={statusLabel(details)} />
              <DetailRow label="Requested" value={formatDate(details.createdAt)} />
              <DetailRow label="Message" value={details.message || "--"} />
              {details.employeeId && <DetailRow label="Employee ID" value={details.employeeId} />}
              {details.teacherId && <DetailRow label="Teacher ID" value={details.teacherId} />}
              {details.userId && <DetailRow label="User ID" value={details.userId} />}
              {details.userRole && <DetailRow label="User Role" value={details.userRole} />}
            </dl>
          </div>
        </div>
      )}

      {/* Confirm modal */}
      {confirmState && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmState(null)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-[#1f2136]">Please confirm</h2>
            <p className="mt-2 text-sm font-medium text-[#5f6888]">{confirmState.text}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmState(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={confirmState.onConfirm} disabled={busy}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 font-semibold text-[#7d86a8]">{label}</dt>
      <dd className="flex-1 font-medium text-[#303247]">{value}</dd>
    </div>
  );
}

function RowActions({
  request,
  busy,
  compact,
  onApprove,
  onReject,
  onReset,
  onArchive,
  onRestore,
  onView
}: {
  request: CommRequest;
  busy: boolean;
  compact?: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReset: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onView: () => void;
}) {
  const isPending = request.status === "pending" && !request.archived;
  const canApproveLeave = request.type === "leave" && isPending;
  const canResetPassword = request.type === "password_reset" && isPending;
  const canReject = (request.type === "leave" || request.type === "password_reset") && isPending;
  const btn = compact
    ? "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold"
    : "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold";

  return (
    <div className={compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap justify-end gap-1.5"}>
      {canApproveLeave && (
        <button className={`${btn} bg-[#e6f8ef] text-[#0f8d52] hover:bg-[#d6f2e3]`} onClick={onApprove} disabled={busy}>
          <CheckCircle2 size={14} /> Approve
        </button>
      )}
      {canResetPassword && (
        <button className={`${btn} bg-[#eef0ff] text-[#3033a1] hover:bg-[#e3e5ff]`} onClick={onReset} disabled={busy}>
          <KeyRound size={14} /> Reset
        </button>
      )}
      {canReject && (
        <button className={`${btn} bg-[#ffebed] text-[#ed515d] hover:bg-[#ffdfe4]`} onClick={onReject} disabled={busy}>
          <XCircle size={14} /> Reject
        </button>
      )}
      {request.archived ? (
        <button className={`${btn} bg-[#eef2ff] text-[#5a63c4] hover:bg-[#e3e8ff]`} onClick={onRestore} disabled={busy}>
          <ArchiveRestore size={14} /> Restore
        </button>
      ) : (
        <button className={`${btn} bg-[#f3f4fb] text-[#5f6888] hover:bg-[#e9ebf5]`} onClick={onArchive} disabled={busy}>
          <Archive size={14} /> Archive
        </button>
      )}
      <button className={`${btn} bg-[#f3f4fb] text-[#5f6888] hover:bg-[#e9ebf5]`} onClick={onView}>
        <Eye size={14} /> {compact ? "" : "View"}
      </button>
    </div>
  );
}
