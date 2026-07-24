"use client";

import { useState, useEffect } from "react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { ShieldAlert, Save, Trash2, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type AiSettings = {
  enabled: boolean;
  provider: string;
  maskedApiKey: string | null;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  features: {
    feeReminder: boolean;
    noticeGenerator: boolean;
    reportSummary: boolean;
    studentSummary: boolean;
  };
};

const MODELS = [
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Recommended)" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Fallback)" },
];

export default function AiSettingsPage() {
  const { role, hasPermission, loading: sessionLoading } = useAdminSession();

  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [feeReminder, setFeeReminder] = useState(true);
  const [noticeGenerator, setNoticeGenerator] = useState(true);
  const [reportSummary, setReportSummary] = useState(true);
  const [studentSummary, setStudentSummary] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [encryptionKeyConfigured, setEncryptionKeyConfigured] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!hasPermission(AI_PERMISSIONS.SETTINGS)) {
      setLoading(false);
      return;
    }
    loadSettings();
  }, [sessionLoading]);

  async function loadSettings() {
    try {
      const res = await adminApiRequest<{ ok: boolean; data: AiSettings; encryptionKeyConfigured: boolean }>(
        "/api/ai/settings"
      );
      if (res.ok && res.data) {
        setSettings(res.data);
        setModel(res.data.model);
        setTemperature(res.data.temperature);
        setMaxTokens(res.data.maxOutputTokens);
        setFeeReminder(res.data.features.feeReminder);
        setNoticeGenerator(res.data.features.noticeGenerator);
        setReportSummary(res.data.features.reportSummary);
        setStudentSummary(res.data.features.studentSummary);
        setEnabled(res.data.enabled);
      }
      setEncryptionKeyConfigured(res.encryptionKeyConfigured);
    } catch {
      setEncryptionKeyConfigured(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!apiKey) {
      setMessage({ type: "error", text: "Please paste your Gemini API key." });
      return;
    }
    if (!encryptionKeyConfigured) {
      setMessage({ type: "error", text: "AI_SECRET_ENCRYPTION_KEY is not configured in .env.local. Cannot save API key." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await adminApiRequest<{ ok: boolean; message: string; maskedApiKey?: string }>(
        "/api/ai/settings",
        {
          method: "POST",
          body: JSON.stringify({
            action: "save",
            apiKey,
            model,
            temperature,
            maxOutputTokens: maxTokens,
            features: { feeReminder, noticeGenerator, reportSummary, studentSummary },
          }),
        }
      );
      if (res.ok) {
        setMessage({ type: "success", text: "API key saved and verified successfully." });
        setApiKey("");
        if (res.maskedApiKey) {
          setSettings((prev) => {
            if (!prev) return prev;
            return { ...prev, maskedApiKey: res.maskedApiKey!, enabled: true };
          });
        }
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage({ type: "error", text: error.message || "Failed to save API key." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const key = apiKey || undefined;
      const res = await adminApiRequest<{ ok: boolean; message: string }>(
        "/api/ai/test-connection",
        { method: "POST", body: JSON.stringify({ apiKey: key }) }
      );
      if (res.ok) {
        setMessage({ type: "success", text: "Gemini API connected successfully!" });
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage({ type: "error", text: error.message || "Connection test failed." });
    } finally {
      setTesting(false);
    }
  }

  async function handleDeleteKey() {
    setSaving(true);
    setMessage(null);
    try {
      await adminApiRequest<{ ok: boolean; message: string }>(
        "/api/ai/settings",
        { method: "POST", body: JSON.stringify({ action: "delete_key" }) }
      );
      setMessage({ type: "success", text: "API key deleted." });
      setSettings((prev) => (prev ? { ...prev, maskedApiKey: null, enabled: false } : prev));
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage({ type: "error", text: error.message || "Failed to delete API key." });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateSettings() {
    setSaving(true);
    setMessage(null);
    try {
      await adminApiRequest<{ ok: boolean; message: string }>(
        "/api/ai/settings",
        {
          method: "POST",
          body: JSON.stringify({
            action: "update_settings",
            model,
            temperature,
            maxOutputTokens: maxTokens,
            enabled,
            features: { feeReminder, noticeGenerator, reportSummary, studentSummary },
          }),
        }
      );
      setMessage({ type: "success", text: "Settings updated." });
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessage({ type: "error", text: error.message || "Failed to update settings." });
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#17217f]" />
      </div>
    );
  }

  if (!hasPermission(AI_PERMISSIONS.SETTINGS)) {
    return (
      <section className="p-4 md:p-7">
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
            <ShieldAlert size={22} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Access denied</h2>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              You do not have permission to access AI Settings.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="border-b border-border bg-card px-4 py-4 md:px-7">
        <h1 className="text-xl font-extrabold text-foreground">AI Settings</h1>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          Configure your Gemini API key and AI preferences
        </p>
      </div>

      <section className="space-y-5 p-4 md:p-7">
        {message && (
          <div
            className={`flex items-start gap-3 rounded-lg border p-4 ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            ) : (
              <XCircle size={20} className="mt-0.5 shrink-0" />
            )}
            <p className="text-sm font-semibold">{message.text}</p>
          </div>
        )}

        <div className="card space-y-4 p-5">
          <h2 className="font-extrabold text-foreground">Gemini API Key</h2>

          {!encryptionKeyConfigured && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              AI_SECRET_ENCRYPTION_KEY is not configured. Add it to .env.local to save API keys securely.
            </div>
          )}

          {settings?.maskedApiKey && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              <CheckCircle2 size={16} />
              Saved key: {settings.maskedApiKey}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-bold text-foreground">New API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste Gemini API key"
              className="field w-full max-w-xl"
            />
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              Your key is stored securely on the server and never exposed to frontend.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !apiKey}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save API Key
            </button>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || (!apiKey && !settings?.maskedApiKey)}
              className="btn-secondary flex items-center gap-2"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Test Connection
            </button>
            {settings?.maskedApiKey && (
              <button
                type="button"
                onClick={handleDeleteKey}
                disabled={saving}
                className="btn-danger flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete API Key
              </button>
            )}
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="font-extrabold text-foreground">Model Configuration</h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} className="field">
                {MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">
                Temperature ({temperature})
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">
                Max Output Tokens
              </label>
              <input
                type="number"
                min={128}
                max={8192}
                step={128}
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                className="field"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="ai-enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="ai-enabled" className="text-sm font-bold text-foreground">
              Enable AI Agent
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleUpdateSettings}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Settings
            </button>
          </div>
        </div>

        <div className="card space-y-3 p-5">
          <h2 className="font-extrabold text-foreground">Feature Toggles</h2>
          <div className="space-y-3">
            {[
              { key: "feeReminder", label: "Enable fee reminder AI", value: feeReminder, set: setFeeReminder },
              { key: "noticeGenerator", label: "Enable notice generator", value: noticeGenerator, set: setNoticeGenerator },
              { key: "reportSummary", label: "Enable report summary", value: reportSummary, set: setReportSummary },
              { key: "studentSummary", label: "Enable student summary", value: studentSummary, set: setStudentSummary },
            ].map((feature) => (
              <div key={feature.key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`feature-${feature.key}`}
                  checked={feature.value}
                  onChange={(e) => feature.set(e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor={`feature-${feature.key}`} className="text-sm font-bold text-foreground">
                  {feature.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="card space-y-4 p-5">
          <h2 className="font-extrabold text-foreground">Quota Protection</h2>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">Firebase Daily Read Soft Limit</label>
              <input type="number" className="field" value="" placeholder="40000" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">Firebase Daily Write Soft Limit</label>
              <input type="number" className="field" value="" placeholder="15000" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">Gemini Daily Request Limit</label>
              <input type="number" className="field" value="" placeholder="50" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">Per-User Daily AI Limit</label>
              <input type="number" className="field" value="" placeholder="20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-foreground">Cache TTL (minutes)</label>
              <input type="number" className="field" value="" placeholder="60" />
            </div>
          </div>

          <p className="text-xs font-medium text-muted-foreground">
            Fine-tune quota limits on the{" "}
            <a href="/admin/ai-agent/quota" className="font-bold text-[#17217f] underline">
              Quota & Usage
            </a>{" "}
            page.
          </p>
        </div>
      </section>
    </>
  );
}
