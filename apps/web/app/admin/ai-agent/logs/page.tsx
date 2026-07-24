"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { ShieldAlert, Loader2, Search, X } from "lucide-react";

type AiLogEntry = {
  id: string;
  feature: string;
  promptType: string;
  inputPreview: string;
  outputPreview: string;
  status: string;
  errorMessage?: string;
  userName: string;
  role: string;
  createdAt: { _seconds: number; _nanoseconds: number } | string;
};

export default function AiLogsPage() {
  const { hasPermission, loading: sessionLoading } = useAdminSession();

  const [logs, setLogs] = useState<AiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [featureFilter, setFeatureFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;
    if (!hasPermission(AI_PERMISSIONS.LOGS)) {
      setLoading(false);
      return;
    }
    loadLogs(true);
  }, [sessionLoading, featureFilter, statusFilter]);

  async function loadLogs(reset = false) {
    try {
      if (reset) {
        setLoading(true);
        setCursor(null);
      } else {
        setLoadingMore(true);
      }

      const params = new URLSearchParams();
      if (featureFilter) params.set("feature", featureFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (!reset && cursor) params.set("cursor", cursor);
      params.set("limit", "25");

      const res = await adminApiRequest<{ ok: boolean; logs: AiLogEntry[]; nextCursor: string | null }>(
        `/api/ai/logs?${params.toString()}`
      );

      if (res.ok) {
        if (reset) {
          setLogs(res.logs);
        } else {
          setLogs((prev) => [...prev, ...res.logs]);
        }
        setCursor(res.nextCursor);
        setHasMore(Boolean(res.nextCursor));
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  function formatTime(ts: unknown): string {
    if (!ts) return "-";
    if (typeof ts === "object" && ts !== null) {
      const t = ts as { _seconds?: number };
      if (typeof t._seconds === "number") {
        return new Date(t._seconds * 1000).toLocaleString();
      }
    }
    return String(ts);
  }

  function getFeatureLabel(feature: string): string {
    const labels: Record<string, string> = {
      chat: "General Chat",
      fee_reminder: "Fee Reminder",
      notice_generator: "Notice Generator",
      dues_summary: "Dues Summary",
      settings: "Settings",
    };
    return labels[feature] || feature;
  }

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#17217f]" />
      </div>
    );
  }

  if (!hasPermission(AI_PERMISSIONS.LOGS)) {
    return (
      <section className="p-4 md:p-7">
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
            <ShieldAlert size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Access denied</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              You do not have permission to view AI logs.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="border-b border-border bg-card px-4 py-4 md:px-7">
        <h1 className="text-xl font-extrabold text-foreground">AI Logs</h1>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          Track AI usage, prompts, and responses
        </p>
      </div>

      <section className="space-y-4 p-4 md:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={featureFilter}
              onChange={(e) => { setFeatureFilter(e.target.value); setCursor(null); }}
              className="field pl-9"
            >
              <option value="">All Features</option>
              <option value="chat">General Chat</option>
              <option value="fee_reminder">Fee Reminder</option>
              <option value="notice_generator">Notice Generator</option>
              <option value="dues_summary">Dues Summary</option>
              <option value="settings">Settings</option>
            </select>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCursor(null); }}
            className="field max-w-[160px]"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
          {(featureFilter || statusFilter) && (
            <button
              type="button"
              onClick={() => { setFeatureFilter(""); setStatusFilter(""); }}
              className="btn-ghost flex items-center gap-1 text-sm"
            >
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-semibold text-muted-foreground">No AI logs found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 font-extrabold text-foreground">Time</th>
                  <th className="px-4 py-3 font-extrabold text-foreground">User</th>
                  <th className="px-4 py-3 font-extrabold text-foreground">Feature</th>
                  <th className="px-4 py-3 font-extrabold text-foreground">Type</th>
                  <th className="px-4 py-3 font-extrabold text-foreground">Status</th>
                  <th className="px-4 py-3 font-extrabold text-foreground">Input</th>
                  <th className="px-4 py-3 font-extrabold text-foreground">Output</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatTime(log.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      {log.userName}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground">
                      {getFeatureLabel(log.feature)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-foreground">
                      {log.promptType}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                          log.status === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {log.inputPreview || "-"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                      {log.outputPreview || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => loadLogs(false)}
              disabled={loadingMore}
              className="btn-secondary flex items-center gap-2"
            >
              {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
              Load More
            </button>
          </div>
        )}
      </section>
    </>
  );
}
