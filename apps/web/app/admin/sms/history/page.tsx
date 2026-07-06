"use client";

import { useState, useEffect, useCallback } from "react";
import { hasPermission } from "@sri-narayana/shared";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { PageHeader } from "@/components/PageHeader";
import { X, RefreshCw, History, Clock, User, FileText, CheckCheck } from "lucide-react";

type SmsHistoryEntry = {
  id: string;
  sentBy: string;
  sentByName: string;
  recipientCount: number;
  templateUsed: string;
  messagePreview: string;
  status: string;
  createdAt: { _seconds?: number; _nanoseconds?: number } | string;
};

function formatDate(ts: unknown): string {
  if (!ts) return "—";
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) {
    const d = new Date((ts as { _seconds: number })._seconds * 1000);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return String(ts);
}

export default function SmsHistoryPage() {
  const { role } = useAdminSession();
  const canView = Boolean(role && hasPermission(role, "sms.view"));

  const [entries, setEntries] = useState<SmsHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: boolean; entries: SmsHistoryEntry[] }>("/api/admin/sms/history?limit=200");
      setEntries(result.entries ?? []);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (!canView) {
    return (
      <section className="p-7">
        <div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div>
      </section>
    );
  }

  return (
    <>
      <PageHeader
        title="SMS History"
        description="Manual log of sent SMS broadcasts."
        action={
          <button onClick={() => void loadHistory()} disabled={loading} className="btn-secondary h-10 rounded-lg px-4 text-sm font-bold">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-[#ffebed] px-4 py-3 text-sm font-bold text-[#d84d5b]">
            <X size={16} /> {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={16} /></button>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-sm text-muted-foreground">
            <History size={40} className="opacity-30" />
            <p>No SMS history yet.</p>
            <p className="text-xs">Entries appear here when messages are marked as sent.</p>
          </div>
        )}

        {loading && <p className="py-4 text-center text-sm text-muted-foreground">Loading...</p>}

        {entries.length > 0 && (
          <div className="card overflow-hidden rounded-xl border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Date & Time</th>
                    <th className="px-4 py-3">Sent By</th>
                    <th className="px-4 py-3 text-right">Recipients</th>
                    <th className="px-4 py-3">Template</th>
                    <th className="px-4 py-3">Message Preview</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50 transition hover:bg-muted/20">
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        <Clock size={12} className="mr-1 inline-block" />
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                        <User size={13} className="mr-1 inline-block text-muted-foreground" />
                        {entry.sentByName || entry.sentBy || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-foreground">{entry.recipientCount}</td>
                      <td className="max-w-[140px] truncate px-4 py-3 text-muted-foreground">{entry.templateUsed || "—"}</td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-muted-foreground">
                        <FileText size={13} className="mr-1 inline-block" />
                        {entry.messagePreview || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-bold text-green-800">
                          <CheckCheck size={12} /> Sent
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
