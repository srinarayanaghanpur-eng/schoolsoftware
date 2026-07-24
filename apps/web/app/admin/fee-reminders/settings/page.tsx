"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Save, Eye, EyeOff } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

type FeeReminderSettings = {
  general: {
    enabled: boolean;
    reminderTime: string;
    channelPriority: string;
    minimumDueAmount: number;
    maxRemindersPerMonth: number;
    skipHolidays: boolean;
    optInRequired: boolean;
  };
  retry: {
    enabled: boolean;
    retryCount: number;
    retryDelayMinutes: number;
  };
  whatsapp: {
    apiKey: string;
    phoneNumberId: string;
    businessAccountId: string;
  };
  sms: {
    apiUrl: string;
    apiKey: string;
    senderId: string;
    dltPeId: string;
    dltHeaderId: string;
    dltTemplateId: string;
  };
  schoolInfo: {
    schoolName: string;
    supportPhone: string;
  };
};

const defaultSettings: FeeReminderSettings = {
  general: {
    enabled: false,
    reminderTime: "09:00",
    channelPriority: "whatsapp_first_sms_fallback",
    minimumDueAmount: 0,
    maxRemindersPerMonth: 3,
    skipHolidays: true,
    optInRequired: true,
  },
  retry: {
    enabled: true,
    retryCount: 2,
    retryDelayMinutes: 30,
  },
  whatsapp: {
    apiKey: "",
    phoneNumberId: "",
    businessAccountId: "",
  },
  sms: {
    apiUrl: "",
    apiKey: "",
    senderId: "",
    dltPeId: "",
    dltHeaderId: "",
    dltTemplateId: "",
  },
  schoolInfo: {
    schoolName: "",
    supportPhone: "",
  },
};

function SectionHeading({ children }: { children: string }) {
  return <h3 className="col-span-full text-base font-bold text-[#303247]">{children}</h3>;
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-semibold text-[#303247] ${className ?? ""}`}>{children}</label>;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-[#3033a1]" : "bg-[#d0d3e6]"}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

export default function FeeReminderSettingsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [settings, setSettings] = useState<FeeReminderSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showWhatsappKey, setShowWhatsappKey] = useState(false);
  const [showSmsKey, setShowSmsKey] = useState(false);

  function patch<K extends keyof FeeReminderSettings>(section: K, value: Partial<FeeReminderSettings[K]>) {
    setSettings((prev) => ({ ...prev, [section]: { ...prev[section], ...value } }));
  }

  async function load() {
    if (!selectedYear?.id) {
      setSettings(defaultSettings);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id });
      const result = await adminApiRequest<FeeReminderSettings>(`/api/admin/fee-reminder-settings?${params}`);
      setSettings(result);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedYear?.id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!selectedYear?.id) { setError("Select an academic year first."); return; }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await adminApiRequest("/api/admin/fee-reminder-settings", {
        method: "PUT",
        body: JSON.stringify({ academicYearId: selectedYear.id, ...settings }),
      });
      setSuccess("Settings saved successfully.");
      window.setTimeout(() => setSuccess(""), 4000);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!hasPermission(role, "fee_reminders.manage_settings")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  const g = settings.general;
  const r = settings.retry;
  const w = settings.whatsapp;
  const s = settings.sms;
  const si = settings.schoolInfo;

  return (
    <>
      <PageHeader title="Fee Reminder Settings" description="Configure automated fee reminder behaviour." />
      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && (
          <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load settings.</div>
        )}

        {error && (
          <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>
        )}

        {success && (
          <div className="card border-l-4 border-l-[#14a762] bg-[#e6f8ef] p-4 text-sm font-semibold text-[#14a762]">{success}</div>
        )}

        {loading ? (
          <div className="card py-10 text-center text-sm font-medium text-[#7d86a8]">Loading settings...</div>
        ) : (
          <form onSubmit={save} className="card space-y-5 p-5 md:p-6">
            {/* General Settings */}
            <div className="grid gap-4 md:grid-cols-2">
              <SectionHeading>General Settings</SectionHeading>

              <div className="flex items-center justify-between md:col-span-2">
                <Field>Enable automatic reminders</Field>
                <Toggle checked={g.enabled} onChange={(v) => patch("general", { enabled: v })} />
              </div>

              <Field>
                Reminder time
                <input className="field mt-1" type="time" value={g.reminderTime} onChange={(e) => patch("general", { reminderTime: e.target.value })} />
              </Field>

              <Field>
                Channel priority
                <select className="field mt-1" value={g.channelPriority} onChange={(e) => patch("general", { channelPriority: e.target.value })}>
                  <option value="whatsapp_first_sms_fallback">WhatsApp first, SMS fallback</option>
                  <option value="sms_first_whatsapp_fallback">SMS first, WhatsApp fallback</option>
                  <option value="whatsapp_only">WhatsApp only</option>
                  <option value="sms_only">SMS only</option>
                </select>
              </Field>

              <Field>
                Minimum due amount
                <input className="field mt-1" type="number" min="0" value={g.minimumDueAmount} onChange={(e) => patch("general", { minimumDueAmount: Number(e.target.value) })} />
              </Field>

              <Field>
                Max reminders per student per month
                <input className="field mt-1" type="number" min="1" value={g.maxRemindersPerMonth} onChange={(e) => patch("general", { maxRemindersPerMonth: Number(e.target.value) })} />
              </Field>

              <div className="flex items-center justify-between">
                <Field className="mb-0">Skip holidays</Field>
                <Toggle checked={g.skipHolidays} onChange={(v) => patch("general", { skipHolidays: v })} />
              </div>

              <div className="flex items-center justify-between">
                <Field className="mb-0">Opt-in required</Field>
                <Toggle checked={g.optInRequired} onChange={(v) => patch("general", { optInRequired: v })} />
              </div>
            </div>

            <hr className="border-[#e3e6f0]" />

            {/* Retry Settings */}
            <div className="grid gap-4 md:grid-cols-2">
              <SectionHeading>Retry Settings</SectionHeading>

              <div className="flex items-center justify-between md:col-span-2">
                <Field className="mb-0">Enable retry</Field>
                <Toggle checked={r.enabled} onChange={(v) => patch("retry", { enabled: v })} />
              </div>

              <Field>
                Retry count
                <input className="field mt-1" type="number" min="0" value={r.retryCount} onChange={(e) => patch("retry", { retryCount: Number(e.target.value) })} />
              </Field>

              <Field>
                Retry delay (minutes)
                <input className="field mt-1" type="number" min="1" value={r.retryDelayMinutes} onChange={(e) => patch("retry", { retryDelayMinutes: Number(e.target.value) })} />
              </Field>
            </div>

            <hr className="border-[#e3e6f0]" />

            {/* WhatsApp API */}
            <div className="grid gap-4 md:grid-cols-2">
              <SectionHeading>WhatsApp API</SectionHeading>

              <Field>
                API Key
                <div className="relative mt-1">
                  <input className="field w-full pr-10" type={showWhatsappKey ? "text" : "password"} value={w.apiKey} onChange={(e) => patch("whatsapp", { apiKey: e.target.value })} />
                  <button type="button" onClick={() => setShowWhatsappKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7d86a8]">
                    {showWhatsappKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <Field>
                Phone Number ID
                <input className="field mt-1" value={w.phoneNumberId} onChange={(e) => patch("whatsapp", { phoneNumberId: e.target.value })} />
              </Field>

              <Field>
                Business Account ID
                <input className="field mt-1" value={w.businessAccountId} onChange={(e) => patch("whatsapp", { businessAccountId: e.target.value })} />
              </Field>
            </div>

            <hr className="border-[#e3e6f0]" />

            {/* SMS API */}
            <div className="grid gap-4 md:grid-cols-2">
              <SectionHeading>SMS API</SectionHeading>

              <Field>
                API URL
                <input className="field mt-1" value={s.apiUrl} onChange={(e) => patch("sms", { apiUrl: e.target.value })} />
              </Field>

              <Field>
                API Key
                <div className="relative mt-1">
                  <input className="field w-full pr-10" type={showSmsKey ? "text" : "password"} value={s.apiKey} onChange={(e) => patch("sms", { apiKey: e.target.value })} />
                  <button type="button" onClick={() => setShowSmsKey((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#7d86a8]">
                    {showSmsKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </Field>

              <Field>
                Sender ID
                <input className="field mt-1" value={s.senderId} onChange={(e) => patch("sms", { senderId: e.target.value })} />
              </Field>

              <Field>
                DLT PE ID
                <input className="field mt-1" value={s.dltPeId} onChange={(e) => patch("sms", { dltPeId: e.target.value })} />
              </Field>

              <Field>
                DLT Header ID
                <input className="field mt-1" value={s.dltHeaderId} onChange={(e) => patch("sms", { dltHeaderId: e.target.value })} />
              </Field>

              <Field>
                DLT Template ID
                <input className="field mt-1" value={s.dltTemplateId} onChange={(e) => patch("sms", { dltTemplateId: e.target.value })} />
              </Field>
            </div>

            <hr className="border-[#e3e6f0]" />

            {/* School Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <SectionHeading>School Info</SectionHeading>

              <Field>
                School name
                <input className="field mt-1" value={si.schoolName} onChange={(e) => patch("schoolInfo", { schoolName: e.target.value })} />
              </Field>

              <Field>
                Support phone number
                <input className="field mt-1" value={si.supportPhone} onChange={(e) => patch("schoolInfo", { supportPhone: e.target.value })} placeholder="+91XXXXXXXXXX" />
              </Field>
            </div>

            <div className="flex justify-end pt-2">
              <button className="btn-primary" disabled={saving || !selectedYear?.id}>
                <Save size={16} /> {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
