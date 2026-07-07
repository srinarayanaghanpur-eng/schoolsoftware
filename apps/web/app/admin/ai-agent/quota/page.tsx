"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import {
  ShieldAlert, Loader2, Database, Brain, Users, BarChart3,
  RefreshCw, Trash2, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";

type QuotaData = {
  usage: {
    geminiRequests: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    totalAiCalls: number;
    cacheHits: number;
    cacheMisses: number;
    failedCalls: number;
    firebaseReads: number;
    firebaseWrites: number;
  };
  userUsage: Array<{
    userId: string;
    userName: string;
    role: string;
    aiCalls: number;
    featureCounts: Record<string, number>;
  }>;
  featureUsage: Record<string, number>;
  mode: "normal" | "saver" | "emergency";
  settings: {
    firebaseDailyReadSoftLimit: number;
    firebaseDailyWriteSoftLimit: number;
    geminiDailyRequestLimit: number;
    geminiDailyTokenLimit: number;
    perUserDailyAiLimit: number;
    enableSaverMode: boolean;
    enableEmergencyMode: boolean;
  };
  cacheStats: {
    totalEntries: number;
    totalHits: number;
    hitRate: number;
  };
};

export default function AiQuotaPage() {
  const { hasPermission, loading: sessionLoading } = useAdminSession();

  const [data, setData] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState({
    firebaseDailyReadSoftLimit: 40000,
    firebaseDailyWriteSoftLimit: 15000,
    geminiDailyRequestLimit: 50,
    geminiDailyTokenLimit: 100000,
    perUserDailyAiLimit: 20,
    cacheTtlMinutes: 60,
    enableSaverMode: true,
    enableEmergencyMode: true,
    disableAiWhenQuotaHigh: true,
    disableAutoSummariesWhenQuotaHigh: true,
    disableBulkAiWhenQuotaHigh: true,
    saverModeThresholdPercent: 80,
  });

  useEffect(() => {
    if (sessionLoading) return;
    if (!hasPermission(AI_PERMISSIONS.VIEW)) {
      setLoading(false);
      return;
    }
    loadData();
  }, [sessionLoading]);

  async function loadData() {
    try {
      const res = await adminApiRequest<{ ok: boolean; data: QuotaData }>("/api/quota/status");
      if (res.ok && res.data) {
        setData(res.data);
        setEditable((prev) => ({
          ...prev,
          ...res.data.settings,
        }));
      }
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  }

  async function handleClearCache() {
    setResetting(true);
    setMessage(null);
    try {
      await adminApiRequest("/api/quota/reset-cache", {
        method: "POST",
        body: JSON.stringify({ action: "clear_cache" }),
      });
      setMessage("Cache cleared.");
      loadData();
    } catch {
      setMessage("Failed to clear cache.");
    } finally {
      setResetting(false);
    }
  }

  async function handleResetAll() {
    setResetting(true);
    setMessage(null);
    try {
      await adminApiRequest("/api/quota/reset-cache", {
        method: "POST",
        body: JSON.stringify({ action: "reset_all" }),
      });
      setMessage("Cache and rate limits reset.");
      loadData();
    } catch {
      setMessage("Failed to reset.");
    } finally {
      setResetting(false);
    }
  }

  async function handleSaveQuota() {
    setSaving(true);
    setMessage(null);
    try {
      await adminApiRequest("/api/ai/settings", {
        method: "POST",
        body: JSON.stringify({ action: "save_quota", ...editable }),
      });
      setMessage("Quota settings saved.");
    } catch {
      setMessage("Failed to save quota settings.");
    } finally {
      setSaving(false);
    }
  }

  function percentUsed(current: number, limit: number): number {
    if (limit <= 0) return 0;
    return Math.round((current / limit) * 100);
  }

  function getModeBadge(mode: string) {
    if (mode === "emergency") return { label: "Emergency Offline Mode", className: "bg-red-100 text-red-700 border-red-200" };
    if (mode === "saver") return { label: "Saver Mode", className: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: "Normal Mode", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  }

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#17217f]" />
      </div>
    );
  }

  if (!hasPermission(AI_PERMISSIONS.VIEW)) {
    return (
      <section className="p-4 md:p-7">
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
            <ShieldAlert size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Access denied</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              You do not have permission to view quota & usage.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const mode = getModeBadge(data?.mode || "normal");
  const u = data?.usage || { geminiRequests: 0, estimatedInputTokens: 0, estimatedOutputTokens: 0, totalAiCalls: 0, cacheHits: 0, cacheMisses: 0, failedCalls: 0, firebaseReads: 0, firebaseWrites: 0 };
  const s = data?.settings || { firebaseDailyReadSoftLimit: 40000, firebaseDailyWriteSoftLimit: 15000, geminiDailyRequestLimit: 50, geminiDailyTokenLimit: 100000, perUserDailyAiLimit: 20, enableSaverMode: true, enableEmergencyMode: true };

  return (
    <>
      <div className="border-b border-border bg-card px-4 py-4 md:px-7">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Quota & Usage</h1>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">
              Monitor AI usage, cache performance, and quota status
            </p>
          </div>
          <div className={`rounded-lg border px-3 py-1.5 text-xs font-extrabold ${mode.className}`}>
            {mode.label}
          </div>
        </div>
      </div>

      <section className="space-y-5 p-4 md:p-7">
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {message}
          </div>
        )}

        {data?.mode === "saver" && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm font-semibold text-amber-800">
              Saver Mode active to protect Firebase/Gemini quota. Some AI features may be limited.
            </p>
          </div>
        )}

        {data?.mode === "emergency" && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <XCircle size={20} className="mt-0.5 shrink-0 text-red-600" />
            <p className="text-sm font-semibold text-red-800">
              Quota protection active. Live AI is paused. Cached data is being shown.
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Database size={20} />}
            label="Firebase Reads Today"
            value={u.firebaseReads.toLocaleString()}
            sub={`Limit: ${s.firebaseDailyReadSoftLimit.toLocaleString()} (${percentUsed(u.firebaseReads, s.firebaseDailyReadSoftLimit)}%)`}
            warning={percentUsed(u.firebaseReads, s.firebaseDailyReadSoftLimit) >= 80}
          />
          <StatCard
            icon={<Database size={20} />}
            label="Firebase Writes Today"
            value={u.firebaseWrites.toLocaleString()}
            sub={`Limit: ${s.firebaseDailyWriteSoftLimit.toLocaleString()} (${percentUsed(u.firebaseWrites, s.firebaseDailyWriteSoftLimit)}%)`}
            warning={percentUsed(u.firebaseWrites, s.firebaseDailyWriteSoftLimit) >= 80}
          />
          <StatCard
            icon={<Brain size={20} />}
            label="Gemini Requests Today"
            value={u.geminiRequests.toLocaleString()}
            sub={`Limit: ${s.geminiDailyRequestLimit.toLocaleString()} (${percentUsed(u.geminiRequests, s.geminiDailyRequestLimit)}%)`}
            warning={percentUsed(u.geminiRequests, s.geminiDailyRequestLimit) >= 80}
          />
          <StatCard
            icon={<BarChart3 size={20} />}
            label="AI Calls Today"
            value={u.totalAiCalls.toLocaleString()}
            sub={`Failed: ${u.failedCalls}`}
            warning={u.failedCalls > 5}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<BarChart3 size={20} />}
            label="Cache Hits"
            value={u.cacheHits.toLocaleString()}
            sub={`Misses: ${u.cacheMisses}`}
          />
          <StatCard
            icon={<BarChart3 size={20} />}
            label="Cache Hit Rate"
            value={`${data?.cacheStats.hitRate || 0}%`}
            sub={`${data?.cacheStats.totalEntries || 0} entries in cache`}
          />
          <StatCard
            icon={<Brain size={20} />}
            label="Est. Input Tokens"
            value={u.estimatedInputTokens.toLocaleString()}
            sub={`Limit: ${s.geminiDailyTokenLimit.toLocaleString()}`}
            warning={percentUsed(u.estimatedInputTokens, s.geminiDailyTokenLimit) >= 80}
          />
          <StatCard
            icon={<Brain size={20} />}
            label="Est. Output Tokens"
            value={u.estimatedOutputTokens.toLocaleString()}
          />
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="font-extrabold text-foreground">Usage by User</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-extrabold text-muted-foreground">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Calls</th>
                  <th className="px-3 py-2">Features</th>
                </tr>
              </thead>
              <tbody>
                {(data?.userUsage || []).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-sm text-muted-foreground">No usage data for today.</td></tr>
                ) : (
                  data?.userUsage.map((u) => (
                    <tr key={u.userId} className="border-b border-border last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{u.userName}</td>
                      <td className="px-3 py-2 text-muted-foreground">{u.role}</td>
                      <td className="px-3 py-2 font-bold">{u.aiCalls}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {Object.entries(u.featureCounts).map(([f, c]) => `${f}: ${c}`).join(", ")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="font-extrabold text-foreground">Usage by Feature</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(data?.featureUsage || {}).length === 0 ? (
              <p className="text-sm text-muted-foreground">No feature usage today.</p>
            ) : (
              Object.entries(data?.featureUsage || {}).sort((a, b) => b[1] - a[1]).map(([feature, count]) => (
                <div key={feature} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{feature}</p>
                  <p className="mt-1 text-2xl font-extrabold text-foreground">{count}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-foreground">Quota Settings</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveQuota}
                disabled={saving}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save Settings
              </button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Firebase Daily Read Soft Limit</label>
              <input
                type="number"
                value={editable.firebaseDailyReadSoftLimit}
                onChange={(e) => setEditable((p) => ({ ...p, firebaseDailyReadSoftLimit: parseInt(e.target.value) || 40000 }))}
                className="field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Firebase Daily Write Soft Limit</label>
              <input
                type="number"
                value={editable.firebaseDailyWriteSoftLimit}
                onChange={(e) => setEditable((p) => ({ ...p, firebaseDailyWriteSoftLimit: parseInt(e.target.value) || 15000 }))}
                className="field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Gemini Daily Request Limit</label>
              <input
                type="number"
                value={editable.geminiDailyRequestLimit}
                onChange={(e) => setEditable((p) => ({ ...p, geminiDailyRequestLimit: parseInt(e.target.value) || 50 }))}
                className="field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Gemini Daily Token Limit</label>
              <input
                type="number"
                value={editable.geminiDailyTokenLimit}
                onChange={(e) => setEditable((p) => ({ ...p, geminiDailyTokenLimit: parseInt(e.target.value) || 100000 }))}
                className="field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Per-User Daily AI Limit</label>
              <input
                type="number"
                value={editable.perUserDailyAiLimit}
                onChange={(e) => setEditable((p) => ({ ...p, perUserDailyAiLimit: parseInt(e.target.value) || 20 }))}
                className="field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Cache TTL (minutes)</label>
              <input
                type="number"
                value={editable.cacheTtlMinutes}
                onChange={(e) => setEditable((p) => ({ ...p, cacheTtlMinutes: parseInt(e.target.value) || 60 }))}
                className="field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">Saver Mode Threshold (%)</label>
              <input
                type="number"
                min={50}
                max={100}
                value={editable.saverModeThresholdPercent}
                onChange={(e) => setEditable((p) => ({ ...p, saverModeThresholdPercent: parseInt(e.target.value) || 80 }))}
                className="field"
              />
            </div>
          </div>
          <div className="space-y-2">
            {([
              { key: "enableSaverMode", label: "Enable Saver Mode" },
              { key: "enableEmergencyMode", label: "Enable Emergency Mode" },
              { key: "disableAiWhenQuotaHigh", label: "Disable AI when quota is high" },
              { key: "disableAutoSummariesWhenQuotaHigh", label: "Disable auto summaries when quota is high" },
              { key: "disableBulkAiWhenQuotaHigh", label: "Disable bulk AI when quota is high" },
            ] as const).map((toggle) => {
              const val = editable[toggle.key];
              return (
                <label key={toggle.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) => setEditable((p) => ({ ...p, [toggle.key]: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-bold text-foreground">{toggle.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleClearCache}
            disabled={resetting}
            className="btn-secondary flex items-center gap-2"
          >
            {resetting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
            Clear Cache
          </button>
          <button
            type="button"
            onClick={handleResetAll}
            disabled={resetting}
            className="btn-danger flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Reset All
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </section>
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  warning,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  warning?: boolean;
}) {
  return (
    <div className={`card p-4 ${warning ? "ring-2 ring-amber-400" : ""}`}>
      <div className="flex items-start justify-between">
        <div className="text-muted-foreground">{icon}</div>
        {warning && <AlertTriangle size={16} className="text-amber-500" />}
      </div>
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs font-medium text-muted-foreground">{sub}</p>}
    </div>
  );
}
