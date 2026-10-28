"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw, AlertCircle, TrendingDown } from "lucide-react";

export function HistoryTab({
  student,
  data
}: {
  student: Record<string, unknown>;
  data: Record<string, unknown> | null;
}) {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const studentId = String(student.id || "");

  useEffect(() => {
    loadLogs();
  }, [studentId]);

  const loadLogs = async () => {
    setLoading(true);
    setError("");
    try {
      const serverLogs = (data?.auditLogs || []) as Record<string, unknown>[];
      setLogs(serverLogs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  const actionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("certificate")) return "text-[#7a3fbf] bg-[#f3eafd]";
    if (a.includes("payment") || a.includes("fee")) return "text-[#18765e] bg-[#e6f8ef]";
    if (a.includes("admission") || a.includes("student.created")) return "text-[#3033a1] bg-[#eef0ff]";
    if (a.includes("edit") || a.includes("update")) return "text-[#ad7413] bg-[#fff7e6]";
    if (a.includes("cancel") || a.includes("delete")) return "text-[#d84d5b] bg-[#fff7f8]";
    return "text-[#6f7898] bg-[#f4f5fb]";
  };

  const formatActor = (log: Record<string, unknown>) => {
    return String(log.actorName || log.actorId || "System");
  };

  const formatDate = (value: unknown) => {
    if (!value) return "—";
    try {
      return new Date(String(value)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return String(value);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">History</h2>
          <p className="text-sm font-medium text-[#7d86a8]">Chronological record of actions for {String(student.studentName || "this student")}</p>
        </div>
      </div>

      {error && (
        <div className="card border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>
      )}

      {loading && (
        <div className="card flex items-center justify-center p-8 text-sm font-medium text-[#7d86a8]">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading history…
        </div>
      )}

      {!loading && logs.length === 0 && !error && (
        <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
          <TrendingDown size={24} className="mx-auto mb-3 opacity-50" />
          <p>No history records found for this student.</p>
          <p className="mt-2 text-[10px] text-[#7d86a8]">History entries are created when actions are performed on this student record.</p>
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Date & Time</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Action</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Actor</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => {
                const action = String(log.action || "—");
                return (
                  <tr key={String(log.id || `log-${idx}`)} className="border-b border-[#f2f4fb] last:border-0">
                    <td className="px-4 py-3 text-xs text-[#5a6488]">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${actionColor(action)}`}>
                        {action.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5a6488] truncate" title={formatActor(log)}>
                      {formatActor(log)}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5a6488]">
                      {String(log.reason || log.description || log.action || "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
