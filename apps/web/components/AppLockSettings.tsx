"use client";

import { useAdminSession } from "@/components/AdminSessionContext";
import {
  DEFAULT_SETTINGS,
  ROLES,
  ROLE_LABELS,
  type AppLockSettings as AppLockSettingsValue,
  type Role,
  type SchoolSettings
} from "@sri-narayana/shared";
import { db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { LockKeyhole, Save, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

const FALLBACK: AppLockSettingsValue = DEFAULT_SETTINGS.appLock ?? {
  enabled: false,
  lockOnStartup: true,
  timeoutMinutes: 5,
  allowDeviceFallback: true,
  roles: [...ROLES]
};

function normalize(value: Partial<AppLockSettingsValue> | undefined): AppLockSettingsValue {
  return {
    enabled: value?.enabled === true,
    lockOnStartup: value?.lockOnStartup !== false,
    timeoutMinutes:
      typeof value?.timeoutMinutes === "number" && Number.isFinite(value.timeoutMinutes)
        ? Math.max(0, Math.min(240, value.timeoutMinutes))
        : FALLBACK.timeoutMinutes,
    allowDeviceFallback: value?.allowDeviceFallback !== false,
    roles: Array.isArray(value?.roles) && value.roles.length > 0 ? value.roles : FALLBACK.roles
  };
}

export function AppLockSettings() {
  const { role } = useAdminSession();
  const canManage = role === "super_admin" || role === "admin" || role === "settings_manager";
  const [form, setForm] = useState<AppLockSettingsValue>(FALLBACK);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canManage || !isFirebaseConfigured) return;
    getDoc<Partial<SchoolSettings>>(doc(db, "settings", "school"))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        setForm(normalize(snapshot.data()?.appLock));
      })
      .catch(() => setError("Could not load app lock settings."));
  }, [canManage]);

  if (!canManage) return null;

  const update = <K extends keyof AppLockSettingsValue>(key: K, value: AppLockSettingsValue[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toggleRole = (nextRole: Role) => {
    setForm((current) => {
      const selected = current.roles.includes(nextRole);
      const roles = selected
        ? current.roles.filter((item) => item !== nextRole)
        : [...current.roles, nextRole];
      return { ...current, roles };
    });
  };

  const save = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        throw new Error("Firebase is not configured, so app lock settings were not saved.");
      }
      if (form.roles.length === 0) {
        throw new Error("Select at least one role for the app lock.");
      }
      await setDoc(
        doc(db, "settings", "school"),
        { appLock: { ...form, roles: [...form.roles] } },
        { merge: true }
      );
      setMessage("App lock settings saved. They apply the next time the mobile app opens.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save app lock settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card space-y-4 p-4 xl:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <LockKeyhole size={18} className="text-[#3033a1]" />
            Mobile app lock
          </h2>
          <p className="mt-1 text-sm font-medium text-[#7d86a8]">
            Ask selected roles to unlock the mobile app with the phone&apos;s face or biometric authentication.
            No face photo is stored by this app.
          </p>
        </div>
        <ShieldCheck className="shrink-0 text-[#0f8d52]" size={22} />
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] bg-[#f8f9ff] px-3 py-3 text-sm">
        <span>
          <span className="block font-bold text-[#303247]">Require app lock</span>
          <span className="font-medium text-[#7d86a8]">
            {form.enabled ? "ON: selected roles must unlock the mobile app." : "OFF: no app lock is shown."}
          </span>
        </span>
        <input
          className="h-5 w-5 accent-[#3033a1]"
          type="checkbox"
          checked={form.enabled}
          onChange={(event) => update("enabled", event.target.checked)}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] px-3 py-3 text-sm">
          <span className="font-semibold text-[#303247]">Lock on app startup</span>
          <input
            className="h-5 w-5 accent-[#3033a1]"
            type="checkbox"
            checked={form.lockOnStartup}
            disabled={!form.enabled}
            onChange={(event) => update("lockOnStartup", event.target.checked)}
          />
        </label>

        <label className="block text-sm">
          Lock after being away
          <select
            className="field mt-1"
            value={form.timeoutMinutes}
            disabled={!form.enabled}
            onChange={(event) => update("timeoutMinutes", Number(event.target.value))}
          >
            <option value={0}>Immediately</option>
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-[#e3e6f0] px-3 py-3 text-sm">
        <span>
          <span className="block font-semibold text-[#303247]">Allow phone passcode fallback</span>
          <span className="font-medium text-[#7d86a8]">
            If face or biometrics fail, the phone passcode can unlock the app.
          </span>
        </span>
        <input
          className="h-5 w-5 accent-[#3033a1]"
          type="checkbox"
          checked={form.allowDeviceFallback}
          disabled={!form.enabled}
          onChange={(event) => update("allowDeviceFallback", event.target.checked)}
        />
      </label>

      <div>
        <p className="text-sm font-semibold text-[#303247]">Roles that must unlock</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((item) => (
            <label key={item} className="flex items-center gap-2 rounded-lg border border-[#edf0f7] px-3 py-2 text-sm font-medium">
              <input
                className="h-4 w-4 accent-[#3033a1]"
                type="checkbox"
                checked={form.roles.includes(item)}
                disabled={!form.enabled}
                onChange={() => toggleRole(item)}
              />
              {ROLE_LABELS[item]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={loading} onClick={() => void save()}>
          <Save size={16} />
          {loading ? "Saving..." : "Save app lock"}
        </button>
        <span className="text-xs font-medium text-[#7d86a8]">
          Face or biometric unlock is handled by the phone. The app never receives or stores a face image.
        </span>
      </div>

      {message && <p className="rounded-xl border border-[#c8f0dc] bg-[#e6f8ef] px-3 py-2 text-sm font-semibold text-[#0f8d52]">{message}</p>}
      {error && <p className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-3 py-2 text-sm font-semibold text-[#c83f4d]">{error}</p>}
    </div>
  );
}
