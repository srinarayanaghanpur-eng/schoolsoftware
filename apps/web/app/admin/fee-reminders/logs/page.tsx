"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Download, Search } from "lucide-react";
import { useEffect, useState } from "react";

type LogEntry = {
  id: string;
  studentName: string;
  parentName: string;
  parentMobile: string;
  channel: string;
  status: string;
  message: string;
  error?: string;
  sentAt: string;
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-[#fff4df] text-[#b8791a]",
  sent: "bg-[#e6f8ef] text-[#14a762]",
  failed: "bg-[#fee7e7] text-[#ed515d]",
  skipped: "bg-[#f0f0f5] text-[#7d86a8]",
  duplicate: "bg-[#dbeafe] text-[#2563eb]",
  processing: "bg-[#fff4df] text-[#b8791a]",
};

export default function FeeReminderLogsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [parentMobile, setParentMobile] = useState("");

  function buildParams(cursor?: string | null) {
    const params = new URLSearchParams({ academicYearId: selectedYear?.id ?? "", pageSize: "50" });
    if (statusFilter) params.set("status", statusFilter);
    if (channelFilter) params.set("channel", channelFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (studentSearch) params.set("search", studentSearch);
    if (parentMobile) params.set("parentMobile", parentMobile);
    if (cursor) params.set("cursor", cursor);
    return params.toString();
  }

  async function load(cursor?: string | null) {
    if (!selectedYear?.id) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const data = await adminApiRequest<{ logs: LogEntry[]; nextCursor: string | null; hasMore: boolean }>(
        `/api/admin/fee-reminder-logs?${buildParams(cursor)}`
      );
      if (cursor) {
        setLogs((prev) => [...prev, ...data.logs]);
      } else {
        setLogs(data.logs);
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedYear?.id, statusFilter, channelFilter, dateFrom, dateTo, studentSearch, parentMobile]);

  function formatDate(value: string) {
    if (!value) return "--";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
  }

  if (!hasPermission(role, "fee_reminders.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Fee Reminder Logs" description="View all sent, failed, and pending fee reminders." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        {/* Filters */}
        <div className="card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#303247]">Status</label>
              <select className="field text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
                <option value="duplicate">Duplicate</option>
                <option value="processing">Processing</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#303247]">Channel</label>
              <select className="field text-sm" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
                <option value="">All</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#303247]">Date from</label>
              <input className="field text-sm" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#303247]">Date to</label>
              <input className="field text-sm" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#303247]">Student name / ID</label>
              <input className="field text-sm" placeholder="Search..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-[#303247]">Parent mobile</label>
              <input className="field text-sm" placeholder="Mobile number" value={parentMobile} onChange={(e) => setParentMobile(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button className="btn-primary text-xs" onClick={() => void load()}>
              <Search size={14} /> Search
            </button>
            <button
              className="rounded-lg border border-[#e0e3f0] px-3 py-1.5 text-xs font-bold text-[#7d86a8]"
              onClick={() => alert("Coming soon")}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Desktop table */}
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Sent At</th>
                <th className="px-4 py-3">Error</th>
              </tr>
            </thead>
            <tbody>
              {loading && logs.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`} className="border-t border-stone-100">
                    <td colSpan={7} className="px-4 py-3"><div className="h-5 w-full animate-pulse rounded bg-[#eef0f7]" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-400">No logs found</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="border-t border-stone-100 hover:bg-[#fafbff]">
                  <td className="px-4 py-3 font-semibold text-[#303247]">{log.studentName}</td>
                  <td className="px-4 py-3 text-[#7d86a8]">{log.parentMobile || "--"}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      log.channel === "whatsapp" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#eef0ff] text-[#3033a1]"
                    }`}>
                      {log.channel?.toUpperCase() || "--"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[log.status] ?? "bg-[#f0f0f5] text-[#7d86a8]"}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-[#5f6888]" title={log.message}>{log.message || "--"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[#7d86a8]">{formatDate(log.sentAt)}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-[#ed515d]" title={log.error}>{log.error || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {loading && logs.length === 0 && (
            <div className="card p-4"><div className="h-16 w-full animate-pulse rounded bg-[#eef0f7]" /></div>
          )}
          {!loading && logs.length === 0 && (
            <div className="card p-8 text-center text-sm text-stone-400">No logs found</div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-bold text-[#303247]">{log.studentName}</p>
                  <p className="mt-0.5 text-xs font-medium text-[#7d86a8]">{log.parentMobile || "--"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_BADGE[log.status] ?? "bg-[#f0f0f5] text-[#7d86a8]"}`}>{log.status}</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  log.channel === "whatsapp" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#eef0ff] text-[#3033a1]"
                }`}>{log.channel?.toUpperCase() || "--"}</span>
                <span className="text-xs text-[#7d86a8]">{formatDate(log.sentAt)}</span>
              </div>
              {log.message && <p className="mt-1 line-clamp-2 text-xs text-[#5f6888]">{log.message}</p>}
              {log.error && <p className="mt-1 text-xs font-semibold text-[#ed515d]">{log.error}</p>}
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
