"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Play, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type QueueItem = {
  id: string;
  studentName: string;
  parentMobile: string;
  channel: string;
  attempts: number;
  lastError: string;
  createdAt: string;
};

export default function FeeReminderRetryQueuePage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const notify = useCallback((kind: "ok" | "err", text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  async function load(cursor?: string | null) {
    if (!selectedYear?.id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, status: "failed", pageSize: "50" });
      if (cursor) params.set("cursor", cursor);
      const data = await adminApiRequest<{ items: QueueItem[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/admin/fee-reminder-queue?${params}`
      );
      if (cursor) {
        setItems((prev) => [...prev, ...data.items]);
      } else {
        setItems(data.items);
        setSelected(new Set());
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedYear?.id]);

  async function retryItem(id: string) {
    setBusy(true);
    try {
      await adminApiRequest("/api/admin/fee-reminder-queue", {
        method: "PUT",
        body: JSON.stringify({ id, status: "pending" })
      });
      notify("ok", "Item moved to retry queue.");
      setItems((prev) => prev.filter((i) => i.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) {
      notify("err", e instanceof AdminApiError ? e.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  async function retryAll() {
    setBusy(true);
    try {
      await adminApiRequest("/api/admin/fee-reminder-action", {
        method: "POST",
        body: JSON.stringify({ action: "retry_failed", academicYearId: selectedYear?.id })
      });
      notify("ok", "Retry all initiated.");
      void load();
    } catch (e) {
      notify("err", e instanceof AdminApiError ? e.message : "Retry all failed");
    } finally {
      setBusy(false);
    }
  }

  async function retryBulk() {
    if (selected.size === 0) { notify("err", "Select at least one item."); return; }
    setBusy(true);
    try {
      await Promise.all(
        items.filter((i) => selected.has(i.id)).map((i) =>
          adminApiRequest("/api/admin/fee-reminder-queue", {
            method: "PUT",
            body: JSON.stringify({ id: i.id, status: "pending" })
          })
        )
      );
      notify("ok", `${selected.size} item(s) moved to retry queue.`);
      setItems((prev) => prev.filter((i) => !selected.has(i.id)));
      setSelected(new Set());
    } catch (e) {
      notify("err", e instanceof AdminApiError ? e.message : "Bulk retry failed");
    } finally {
      setBusy(false);
    }
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (items.every((i) => prev.has(i.id))) return new Set();
      const n = new Set(prev);
      items.forEach((i) => n.add(i.id));
      return n;
    });
  };

  const allSelected = items.length > 0 && items.every((i) => selected.has(i.id));
  const selectedCount = useMemo(() => items.filter((i) => selected.has(i.id)).length, [items, selected]);

  const totalFailed = items.length;
  const attemptsDist = useMemo(() => {
    const dist: Record<number, number> = {};
    items.forEach((i) => { dist[i.attempts] = (dist[i.attempts] || 0) + 1; });
    return Object.entries(dist).sort(([a], [b]) => Number(a) - Number(b));
  }, [items]);

  if (!hasPermission(role, "fee_reminders.retry_failed")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Failed Reminder Retry Queue" description="Review and retry failed fee reminders." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        {toast && (
          <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            toast.kind === "ok" ? "border-[#c8f0dc] bg-[#e6f8ef] text-[#0f8d52]" : "border-[#ffd5da] bg-[#ffebed] text-[#c83f4d]"
          }`}>{toast.text}</div>
        )}

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="text-xs font-semibold text-[#7d86a8] uppercase tracking-wide">Total Failed</p>
            <p className="mt-1 text-3xl font-extrabold text-[#ed515d]">{totalFailed}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold text-[#7d86a8] uppercase tracking-wide">Retry Attempts Distribution</p>
            <div className="mt-2 space-y-1">
              {attemptsDist.length === 0 ? (
                <p className="text-sm text-[#7d86a8]">No data</p>
              ) : attemptsDist.map(([attempts, count]) => (
                <div key={attempts} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-[#303247]">{attempts} attempt{Number(attempts) !== 1 ? "s" : ""}</span>
                  <div className="h-2 flex-1 rounded-full bg-[#eef0f7]">
                    <div className="h-2 rounded-full bg-[#ed515d]" style={{ width: `${(count / totalFailed) * 100}%` }} />
                  </div>
                  <span className="font-medium text-[#7d86a8]">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#6b7391]">{selectedCount} selected</span>
          <button className="btn-primary text-xs" onClick={() => void retryAll()} disabled={busy || totalFailed === 0}>
            <RotateCcw size={14} /> Retry All
          </button>
          <button className="btn-secondary text-xs" onClick={() => void retryBulk()} disabled={busy || selectedCount === 0}>
            <RefreshCw size={14} /> Retry Selected ({selectedCount})
          </button>
        </div>

        {/* Desktop table */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Last Error</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-t border-stone-100">
                    <td colSpan={8} className="px-4 py-3"><div className="h-5 w-full animate-pulse rounded bg-[#eef0f7]" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">No failed reminders in queue</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="border-t border-stone-100 hover:bg-[#fafbff]">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} aria-label="Select row" />
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#303247]">{item.studentName}</td>
                  <td className="px-4 py-3 text-[#7d86a8]">{item.parentMobile || "--"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      item.channel === "whatsapp" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#eef0ff] text-[#3033a1]"
                    }`}>{item.channel?.toUpperCase() || "--"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-[#fee7e7] px-2.5 py-1 text-xs font-bold text-[#ed515d]">{item.attempts}</span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-[#ed515d]" title={item.lastError}>{item.lastError || "--"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#7d86a8]">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "--"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-lg bg-[#eef0ff] px-3 py-1.5 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]" onClick={() => void retryItem(item.id)} disabled={busy}>
                      <Play size={13} /> Retry
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {loading && items.length === 0 && (
            <div className="card p-4"><div className="h-16 w-full animate-pulse rounded bg-[#eef0f7]" /></div>
          )}
          {!loading && items.length === 0 && (
            <div className="card p-8 text-center text-sm text-stone-400">No failed reminders in queue</div>
          )}
          {items.map((item) => (
            <div key={item.id} className="card p-4">
              <div className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} aria-label="Select row" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-base font-bold text-[#303247]">{item.studentName}</p>
                    <span className="shrink-0 rounded-full bg-[#fee7e7] px-2.5 py-1 text-xs font-bold text-[#ed515d]">{item.attempts} attempt{item.attempts !== 1 ? "s" : ""}</span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-[#7d86a8]">{item.parentMobile || "--"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      item.channel === "whatsapp" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#eef0ff] text-[#3033a1]"
                    }`}>{item.channel?.toUpperCase() || "--"}</span>
                    <span className="text-xs text-[#7d86a8]">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : "--"}</span>
                  </div>
                  {item.lastError && <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#ed515d]">{item.lastError}</p>}
                  <div className="mt-2">
                    <button className="rounded-lg bg-[#eef0ff] px-3 py-1.5 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]" onClick={() => void retryItem(item.id)} disabled={busy}>
                      <Play size={13} /> Retry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="text-center">
            <button className="btn-secondary" onClick={() => void load(nextCursor)} disabled={loading}>
              {loading ? "Loading..." : "Load more"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
