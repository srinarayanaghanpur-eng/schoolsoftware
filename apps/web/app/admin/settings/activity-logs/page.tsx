"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { AlertCircle, Download, Loader2, RefreshCw, ScrollText, Search } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";

type ActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  description: string;
  ipAddress: string;
  deviceInfo: string;
  source: string;
  createdAt: string;
};

type ActivityResponse = {
  ok: boolean;
  entries: ActivityEntry[];
  total: number;
  hasMore: boolean;
  truncated: boolean;
  modules: string[];
  error?: string;
};

const TYPE_OPTIONS = [
  { value: "", label: "All events" },
  { value: "session", label: "Sessions" },
  { value: "create", label: "Created" },
  { value: "update", label: "Updated" },
  { value: "delete", label: "Deleted" },
  { value: "generate", label: "Generated" },
  { value: "other", label: "Other" }
];

function categoryOf(action: string): string {
  const value = action.toLowerCase();
  if (/(login|logout|sign_in|sign_out)/.test(value)) return "session";
  if (/(generate|export|download|print)/.test(value)) return "generate";
  if (/(delete|erase|remove)/.test(value)) return "delete";
  if (/(create|upload|import|mark|issue|add)/.test(value)) return "create";
  if (/(update|edit|approve|reject|confirm|cancel|assign|transfer|promote|close|reopen|pay|send|resend|retry|reset_password|verify|restore)/.test(value)) return "update";
  return "other";
}

const BADGE_CLASS: Record<string, string> = {
  session: "bg-[#e8f0ff] text-[#3d63c9]",
  create: "bg-[#e6f8ef] text-[#0f8d52]",
  update: "bg-[#fff4e1] text-[#a76a12]",
  delete: "bg-[#ffebed] text-[#c83f4d]",
  generate: "bg-[#f1ecff] text-[#6b47b8]",
  other: "bg-[#eef0f6] text-[#5c6485]"
};

function moduleLabel(entry: ActivityEntry) {
  return (entry.entityType || entry.action.split(".")[0] || "system").replace(/_/g, " ");
}

function verbLabel(action: string) {
  const verb = action.includes(".") ? action.slice(action.lastIndexOf(".") + 1) : action;
  return verb.replace(/_/g, " ");
}

function roleLabel(role: string) {
  return role ? role.replace(/_/g, " ") : "--";
}

function formatWhen(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function AccessNotice() {
  return (
    <section className="p-4 md:p-7">
      <div className="card flex max-w-2xl items-start gap-4 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
          <AlertCircle size={22} />
        </span>
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Access denied</h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">
            The activity log is restricted to the super admin and settings manager.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function ActivityLogPage() {
  const { role } = useAdminSession();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [module, setModule] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const canView = role === "super_admin" || role === "settings_manager";

  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), 400);
    return () => clearTimeout(timer);
  }, [qInput]);

  const loadPage = useCallback(
    async (nextOffset: number, append: boolean) => {
      if (!canView) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (type) params.set("type", type);
        if (module) params.set("module", module);
        if (from) params.set("from", `${from}T00:00:00.000Z`);
        if (to) params.set("to", `${to}T23:59:59.999Z`);
        params.set("limit", "100");
        params.set("offset", String(nextOffset));
        const result = await adminApiRequest<ActivityResponse>(`/api/admin/activity-logs?${params.toString()}`);
        setEntries((prev) => (append ? [...prev, ...result.entries] : result.entries));
        setModules(result.modules ?? []);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setTruncated(result.truncated);
        setOffset(nextOffset);
      } catch (err) {
        setError(err instanceof AdminApiError ? err.message : "Unable to load the activity log.");
      } finally {
        setLoading(false);
      }
    },
    [canView, from, module, q, to, type]
  );

  useEffect(() => {
    void loadPage(0, false);
  }, [loadPage]);

  if (!canView) return <AccessNotice />;

  const exportCsv = () => {
    if (!entries.length) return;
    const rows = [
      ["When", "Who", "Role", "Action", "Module", "Entity", "Details", "IP"],
      ...entries.map((entry) => [
        formatWhen(entry.createdAt),
        entry.actorName || entry.actorId,
        roleLabel(entry.actorRole),
        verbLabel(entry.action),
        moduleLabel(entry),
        entry.entityId,
        entry.description,
        entry.ipAddress
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setQInput("");
    setQ("");
    setType("");
    setModule("");
    setFrom("");
    setTo("");
  };

  const filtersActive = Boolean(q || type || module || from || to);

  return (
    <>
      <PageHeader
        title="Activity Log"
        description="Every sign-in and change made across the back office, newest first."
        action={
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => void loadPage(0, false)} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" className="btn-secondary" onClick={exportCsv} disabled={!entries.length}>
              <Download size={16} /> Export CSV
            </button>
          </div>
        }
      />

      <section className="space-y-5 p-4 md:p-7">
      <div className="card space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[240px] flex-1 space-y-1 text-sm font-semibold text-[#303247]">
            <span className="flex items-center gap-1.5">
              <Search size={14} /> Search
            </span>
            <input
              className="field"
              placeholder="Name, action, entity, IP..."
              value={qInput}
              onChange={(event) => setQInput(event.target.value)}
            />
          </label>
          <label className="w-40 space-y-1 text-sm font-semibold text-[#303247]">
            Event
            <select className="field" value={type} onChange={(event) => setType(event.target.value)}>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="w-44 space-y-1 text-sm font-semibold text-[#303247]">
            Module
            <select className="field" value={module} onChange={(event) => setModule(event.target.value)}>
              <option value="">All modules</option>
              {modules.map((item) => (
                <option key={item} value={item}>
                  {item.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="w-40 space-y-1 text-sm font-semibold text-[#303247]">
            From
            <input type="date" className="field" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="w-40 space-y-1 text-sm font-semibold text-[#303247]">
            To
            <input type="date" className="field" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          {filtersActive && (
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Clear
            </button>
          )}
        </div>
        <p className="text-xs font-semibold text-[#7d86a8]">
          {loading && !entries.length
            ? "Loading activity..."
            : `${total} matching event${total === 1 ? "" : "s"}${truncated ? " — showing the most recent 800 entries per source" : ""}`}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="card overflow-hidden">
        {loading && !entries.length ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm font-semibold text-[#7d86a8]">
            <Loader2 size={18} className="animate-spin" /> Loading activity...
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <ScrollText size={28} className="text-[#a4abc5]" />
            <p className="text-sm font-semibold text-[#5c6485]">No activity matches these filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-[#f6f7fb] text-left text-xs font-bold uppercase tracking-wide text-[#7d86a8]">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Who</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Details</th>
                  <th className="px-4 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef0f6]">
                {entries.map((entry) => {
                  const category = categoryOf(entry.action);
                  const expanded = expandedId === entry.id;
                  return (
                    <Fragment key={entry.id}>
                      <tr
                        className="cursor-pointer align-top transition hover:bg-[#f9fafd]"
                        onClick={() => setExpandedId(expanded ? null : entry.id)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#303247]">{formatWhen(entry.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[#1f2136]">{entry.actorName || entry.actorId || "System"}</div>
                          <div className="text-xs font-semibold capitalize text-[#7d86a8]">{roleLabel(entry.actorRole)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${BADGE_CLASS[category]}`}>
                            {verbLabel(entry.action)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold capitalize text-[#5c6485]">{moduleLabel(entry)}</td>
                        <td className="max-w-[320px] px-4 py-3 text-[#5c6485]">
                          <p className="truncate">{entry.description || entry.entityId || "--"}</p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-[#7d86a8]">{entry.ipAddress || "--"}</td>
                      </tr>
                      {expanded && (
                        <tr className="bg-[#f9fafd]">
                          <td colSpan={6} className="px-4 py-4">
                            <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                              <div>
                                <dt className="font-bold uppercase tracking-wide text-[#a4abc5]">Action</dt>
                                <dd className="mt-1 font-semibold text-[#303247]">{entry.action}</dd>
                              </div>
                              <div>
                                <dt className="font-bold uppercase tracking-wide text-[#a4abc5]">User ID</dt>
                                <dd className="mt-1 break-all font-semibold text-[#303247]">{entry.actorId || "--"}</dd>
                              </div>
                              <div>
                                <dt className="font-bold uppercase tracking-wide text-[#a4abc5]">Entity</dt>
                                <dd className="mt-1 break-all font-semibold text-[#303247]">
                                  {entry.entityType || "--"}
                                  {entry.entityId ? ` / ${entry.entityId}` : ""}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-bold uppercase tracking-wide text-[#a4abc5]">Source</dt>
                                <dd className="mt-1 font-semibold text-[#303247]">{entry.source || "app"}</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="font-bold uppercase tracking-wide text-[#a4abc5]">Request / Description</dt>
                                <dd className="mt-1 break-all font-semibold text-[#303247]">{entry.description || "--"}</dd>
                              </div>
                              <div className="sm:col-span-2">
                                <dt className="font-bold uppercase tracking-wide text-[#a4abc5]">Device</dt>
                                <dd className="mt-1 break-all font-semibold text-[#303247]">{entry.deviceInfo || "--"}</dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="border-t border-[#eef0f6] p-4 text-center">
            <button type="button" className="btn-secondary" onClick={() => void loadPage(offset + 100, true)} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null} Load more
            </button>
          </div>
        )}
      </div>
      </section>
    </>
  );
}
