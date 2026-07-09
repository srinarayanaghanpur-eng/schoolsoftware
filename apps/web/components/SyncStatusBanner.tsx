"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { invalidateAdminApiCache } from "@/lib/adminApiClient";
import { useAuth } from "@/components/AuthProvider";

type SyncStatus = "checking" | "clean" | "dirty" | "never_built" | "error";

const REBUILD_ALLOWED_ROLES = ["super_admin", "admin", "settings_manager"];

export default function SyncStatusBanner() {
  const { role } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [dismissed, setDismissed] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [lastClean, setLastClean] = useState<string | null>(null);
  const [lastDirty, setLastDirty] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const canRebuild = role && REBUILD_ALLOWED_ROLES.includes(role);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/sync/status");
      const data = await res.json();
      if (data.ok) {
        setStatus(data.status);
        setLastClean(data.lastCleanAt);
        setLastDirty(data.lastDirtyAt);
        setErrorMsg(null);
      } else {
        setStatus("error");
        setErrorMsg(data.error);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  useEffect(() => {
    const handler = () => {
      checkStatus();
      invalidateAdminApiCache();
    };
    window.addEventListener("snapi:force-sync", handler);
    return () => window.removeEventListener("snapi:force-sync", handler);
  }, [checkStatus]);

  // Clear toast after 4 seconds
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Clear error on next successful checkStatus
  useEffect(() => {
    if (status === "clean") setErrorMsg(null);
  }, [status]);

  const handleRebuild = async () => {
    setRebuilding(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/admin/sync/rebuild-dashboard-summary", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setStatus("clean");
        setToastMsg("Dashboard rebuilt successfully");
        invalidateAdminApiCache();
        window.dispatchEvent(new CustomEvent("snapi:force-sync"));
      } else {
        setErrorMsg(data.error ?? data.reason ?? "Rebuild failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error during rebuild";
      setErrorMsg(msg);
    } finally {
      setRebuilding(false);
    }
  };

  if (dismissed || status === "checking" || status === "clean") return null;

  const formatTime = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString("en-IN");
    } catch {
      return iso;
    }
  };

  const isDirty = status === "dirty" || status === "never_built";

  return (
    <>
      {toastMsg && (
        <div className="fixed bottom-20 right-4 z-50 max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 p-3 shadow-lg dark:border-emerald-800 dark:bg-emerald-950/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-100">{toastMsg}</p>
          </div>
        </div>
      )}
      <div className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border p-4 shadow-lg transition-all ${
        isDirty
          ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/80"
          : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/80"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            {isDirty ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-amber-900 dark:text-amber-100">
                {status === "never_built"
                  ? "Dashboard cache has not been rebuilt yet."
                  : "Dashboard data may be stale"}
              </p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
                {lastClean
                  ? `Last clean: ${formatTime(lastClean)}`
                  : "Dashboard cache has not been rebuilt yet."}
                {lastDirty ? ` · Last mutation: ${formatTime(lastDirty)}` : ""}
              </p>
              {errorMsg && (
                <p className="mt-0.5 text-xs font-bold text-red-600 dark:text-red-400">{errorMsg}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                {canRebuild ? (
                  <button
                    onClick={handleRebuild}
                    disabled={rebuilding}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-extrabold text-white transition hover:bg-amber-700 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${rebuilding ? "animate-spin" : ""}`} />
                    {rebuilding ? "Rebuilding..." : "Rebuild Now"}
                  </button>
                ) : (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    Dashboard cache will update automatically.
                  </p>
                )}
                <button
                  onClick={() => setDismissed(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-extrabold text-amber-700 transition hover:bg-amber-50 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300"
                >
                  <X className="h-3.5 w-3.5" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
