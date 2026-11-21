"use client";

import { PageHeader } from "@/components/PageHeader";
import { usePopup } from "@/components/CenterPopup";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import {
  DEFAULT_COMMUNICATION_SETTINGS,
  SMS_PROVIDERS,
  smsSegments,
  toWhatsAppNumber,
  type CommunicationSettings
} from "@/lib/communications";
import { CLASS_LABELS, CLASS_SELECTOR_CLASSES } from "@/lib/studentClasses";
import { useClassSections } from "@/lib/useClassSections";
import { isDesktopApp } from "@/lib/desktopBridge";
import { hasPermission } from "@sri-narayana/shared";
import {
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
  Save,
  Send,
  Settings2,
  Smartphone,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

type Tab = "compose" | "gateway" | "logs";

type Recipient = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string;
  section: string;
  phone: string;
};

type SendResult = { phone: string; name: string; ok: boolean; error?: string };

type LogRow = {
  id: string;
  channel: string;
  message: string;
  total: number;
  sent: number;
  failed: number;
  createdAt?: string;
  sentByName?: string;
};

const emptySettings: CommunicationSettings = { ...DEFAULT_COMMUNICATION_SETTINGS };

export default function CommunicationsPage() {
  const { role } = useAdminSession();
  const popup = usePopup();
  const { sectionsFor } = useClassSections();
  const canSend = hasPermission(role, "communication.create");
  const canEditSettings = hasPermission(role, "communication.edit");

  const [tab, setTab] = useState<Tab>("compose");
  const [isDesktop, setIsDesktop] = useState(false);
  const [className, setClassName] = useState("");
  const [section, setSection] = useState("");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("whatsapp");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [settings, setSettings] = useState<CommunicationSettings>(emptySettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState("");

  const sectionOptions = className ? sectionsFor(className) : [];
  const selectedRecipients = recipients.filter((item) => selected.has(item.studentId));
  const waNumber = (phone: string) => toWhatsAppNumber(phone);
  const waLinks = useMemo(
    () =>
      selectedRecipients.map((item) => ({
        ...item,
        url: `https://wa.me/${waNumber(item.phone)}?text=${encodeURIComponent(message)}`
      })),
    [selectedRecipients, message]
  );

  useEffect(() => {
    const desktop = isDesktopApp();
    setIsDesktop(desktop);
    if (!desktop) return;
    void adminApiRequest<{ settings: CommunicationSettings }>("/api/admin/communications/settings")
      .then((data) => setSettings({ ...emptySettings, ...data.settings }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (tab !== "logs" || logs.length > 0) return;
    setLogsLoading(true);
    void adminApiRequest<{ logs: LogRow[] }>("/api/admin/communications/logs", undefined, { fresh: true })
      .then((data) => setLogs(data.logs ?? []))
      .catch(() => undefined)
      .finally(() => setLogsLoading(false));
  }, [tab, logs.length]);

  const loadRecipients = async () => {
    if (!className) {
      popup.error("Pick a class", "Choose a class first.");
      return;
    }
    setLoadingRecipients(true);
    setError("");
    try {
      const params = new URLSearchParams({ class: className });
      if (section) params.set("section", section);
      const data = await adminApiRequest<{ recipients: Recipient[] }>(
        `/api/admin/communications/recipients?${params.toString()}`,
        undefined,
        { fresh: true }
      );
      const list = data.recipients ?? [];
      setRecipients(list);
      setSelected(new Set(list.map((item) => item.studentId)));
      setResults([]);
      if (list.length === 0) setError("No students with a phone number in this class/section.");
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Unable to load recipients");
    } finally {
      setLoadingRecipients(false);
    }
  };

  const toggleRecipient = (studentId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(recipients.map((item) => item.studentId)));
  const clearAll = () => setSelected(new Set());

  const sendAuto = async () => {
    if (sending) return;
    if (!isDesktop) {
      popup.error("Desktop app required", "Auto-send and gateway settings are available in the desktop app. Use wa.me links here.");
      return;
    }
    if (!message.trim()) {
      popup.error("Message is empty", "Write the message first.");
      return;
    }
    if (selectedRecipients.length === 0) {
      popup.error("No recipients", "Select at least one student.");
      return;
    }
    setSending(true);
    setError("");
    try {
      const data = await adminApiRequest<{ sent: number; failed: number; results: SendResult[] }>(
        "/api/admin/communications/send",
        {
          method: "POST",
          body: JSON.stringify({
            channel,
            message,
            recipients: selectedRecipients.map((item) => ({
              name: item.studentName,
              phone: item.phone,
              studentId: item.studentId
            }))
          })
        }
      );
      setResults(data.results ?? []);
      setLogs([]);
      if (data.failed > 0) {
        popup.error("Partially sent", `${data.sent} sent, ${data.failed} failed. Check the results below.`);
      } else {
        popup.success(`Sent to ${data.sent} recipient(s)`);
      }
    } catch (err) {
      popup.error("Send failed", err instanceof AdminApiError ? err.message : "Please check gateway settings.");
    } finally {
      setSending(false);
    }
  };

  const copyPhoneList = async () => {
    const text = selectedRecipients.map((item) => `${item.studentName}: +${waNumber(item.phone)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      popup.success("Copied", "Phone list copied to clipboard.");
    } catch {
      popup.error("Copy failed", "Select and copy manually.");
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (savingSettings) return;
    setSavingSettings(true);
    try {
      const data = await adminApiRequest<{ settings: CommunicationSettings }>("/api/admin/communications/settings", {
        method: "PUT",
        body: JSON.stringify(settings)
      });
      setSettings({ ...emptySettings, ...data.settings });
      popup.success("Gateway settings saved");
    } catch (err) {
      popup.error("Could not save", err instanceof AdminApiError ? err.message : "Please try again.");
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Communications"
        description={
          isDesktop
            ? "SMS gateway, WhatsApp manual links and auto-send in one place. Shortcut: Ctrl+Shift+M."
            : "Limited web mode: manual WhatsApp wa.me links only. Open the desktop app for SMS gateway and auto-send."
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        <div className="flex flex-wrap gap-2">
          {([
            { key: "compose", label: "Compose", icon: Send },
            ...(isDesktop
              ? [
                  { key: "gateway" as const, label: "SMS / WhatsApp Gateway", icon: Settings2 },
                  { key: "logs" as const, label: "Send Logs", icon: Users }
                ]
              : [])
          ] as const).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${tab === item.key ? "btn-primary" : "btn-secondary"}`}
              >
                <Icon size={16} /> {item.label}
              </button>
            );
          })}
        </div>

        {error && <div className="card border-l-4 border-l-red-500 p-4 text-sm font-semibold text-red-500">{error}</div>}

        {!isDesktop && (
          <div className="card border-l-4 border-l-amber-500 p-4 text-sm font-semibold text-amber-600">
            Web mode is limited to manual WhatsApp links (wa.me) and copying phone numbers. Install/open the desktop app
            for SMS gateway configuration, WhatsApp Cloud API auto-send and send logs.
          </div>
        )}

        {tab === "compose" && (
          <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="card space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-sm font-semibold">
                  Class
                  <select
                    className="field mt-1"
                    value={className}
                    onChange={(event) => {
                      setClassName(event.target.value);
                      setSection("");
                      setRecipients([]);
                      setSelected(new Set());
                    }}
                  >
                    <option value="">Select class</option>
                    {CLASS_SELECTOR_CLASSES.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Section
                  <select className="field mt-1" value={section} onChange={(event) => setSection(event.target.value)}>
                    <option value="">All sections</option>
                    {sectionOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button type="button" className="btn-secondary w-full" onClick={() => void loadRecipients()} disabled={loadingRecipients}>
                    {loadingRecipients ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />} Load
                  </button>
                </div>
              </div>

              <label className="block text-sm font-semibold">
                Message
                <textarea
                  className="field mt-1 min-h-[140px]"
                  maxLength={1000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Dear Parent, …"
                />
                <span className="mt-1 block text-xs font-medium text-muted-foreground">
                  {message.length}/1000 chars · approx. {smsSegments(message)} SMS segment(s)
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">Channel:</span>
                {(["whatsapp", "sms"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setChannel(item)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold ${channel === item ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {item === "whatsapp" ? <MessageCircle size={14} /> : <Smartphone size={14} />}
                    {item === "whatsapp" ? "WhatsApp" : "SMS"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {isDesktop && (
                  <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => void sendAuto()} disabled={!canSend || sending || selectedRecipients.length === 0}>
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Auto send
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2"
                  onClick={() => {
                    if (waLinks[0]) window.open(waLinks[0].url, "_blank", "noopener,noreferrer");
                  }}
                  disabled={waLinks.length === 0}
                >
                  <ExternalLink size={16} /> Open WhatsApp link
                </button>
                <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => void copyPhoneList()} disabled={selectedRecipients.length === 0}>
                  <Copy size={16} /> Copy phones
                </button>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                {isDesktop
                  ? `Auto send uses ${channel === "sms" ? "the SMS gateway" : "WhatsApp Cloud API"} from Gateway settings. Manual wa.me links work even without a gateway and open one recipient at a time.`
                  : "Manual wa.me links open one recipient at a time and need no gateway. Auto-send is desktop-only."}
              </p>

              {results.length > 0 && (
                <div className="rounded-xl border border-border p-3">
                  <p className="mb-2 text-sm font-bold">Last send results</p>
                  <ul className="max-h-56 space-y-1 overflow-auto text-xs">
                    {results.map((result) => (
                      <li key={`${result.phone}-${result.name}`} className="flex justify-between gap-3">
                        <span className="font-semibold">{result.name || "Recipient"} · {result.phone}</span>
                        <span className={result.ok ? "font-bold text-emerald-600" : "font-bold text-red-500"}>
                          {result.ok ? "Sent" : result.error || "Failed"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                <p className="text-sm font-bold">{recipients.length} recipient(s) · {selected.size} selected</p>
                <div className="flex gap-2">
                  <button type="button" className="text-xs font-bold text-primary" onClick={selectAll}>Select all</button>
                  <button type="button" className="text-xs font-bold text-muted-foreground" onClick={clearAll}>Clear</button>
                </div>
              </div>
              <div className="max-h-[520px] overflow-auto">
                {recipients.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">Load a class to see students with phone numbers.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {recipients.map((item) => (
                      <li key={item.studentId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                        <label className="flex min-w-0 items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected.has(item.studentId)}
                            onChange={() => toggleRecipient(item.studentId)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{item.studentName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {CLASS_LABELS[item.className] ?? item.className}{item.section ? ` - ${item.section}` : ""} · {item.phone}
                            </span>
                          </span>
                        </label>
                        {message && (
                          <a
                            href={`https://wa.me/${waNumber(item.phone)}?text=${encodeURIComponent(message)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-emerald-600"
                          >
                            wa.me
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "gateway" && (
          <form onSubmit={saveSettings} className="grid gap-5 lg:grid-cols-2">
            <div className="card space-y-4 p-5">
              <h2 className="flex items-center gap-2 font-bold"><Smartphone size={18} /> SMS Gateway</h2>
              <label className="flex items-center justify-between text-sm font-semibold">
                Enable SMS
                <input type="checkbox" checked={settings.smsEnabled} onChange={(event) => setSettings({ ...settings, smsEnabled: event.target.checked })} />
              </label>
              <label className="text-sm font-semibold">
                Provider
                <select className="field mt-1" value={settings.smsProvider} onChange={(event) => setSettings({ ...settings, smsProvider: event.target.value as CommunicationSettings["smsProvider"] })}>
                  {SMS_PROVIDERS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                API URL
                <input className="field mt-1" value={settings.smsApiUrl} onChange={(event) => setSettings({ ...settings, smsApiUrl: event.target.value })} placeholder="https://api.ctrlshiftm.com/v1/sms/send" />
              </label>
              <label className="text-sm font-semibold">
                API key
                <input className="field mt-1" type="password" value={settings.smsApiKey} onChange={(event) => setSettings({ ...settings, smsApiKey: event.target.value })} placeholder="Leave dots to keep saved key" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Sender ID
                  <input className="field mt-1" value={settings.smsSenderId} onChange={(event) => setSettings({ ...settings, smsSenderId: event.target.value })} placeholder="SCHOOL" />
                </label>
                <label className="text-sm font-semibold">
                  Template ID (DLT)
                  <input className="field mt-1" value={settings.smsTemplateId} onChange={(event) => setSettings({ ...settings, smsTemplateId: event.target.value })} />
                </label>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                CtrlShiftM sends JSON with <code>api_key, sender_id, template_id, mobile, message</code>. Custom sends <code>apiKey, senderId, templateId, to, message</code>. MSG91 uses its v2 send API with the authkey header.
              </p>
            </div>

            <div className="card space-y-4 p-5">
              <h2 className="flex items-center gap-2 font-bold"><MessageCircle size={18} /> WhatsApp</h2>
              <label className="flex items-center justify-between text-sm font-semibold">
                Enable WhatsApp auto-send
                <input type="checkbox" checked={settings.whatsappEnabled} onChange={(event) => setSettings({ ...settings, whatsappEnabled: event.target.checked })} />
              </label>
              <label className="text-sm font-semibold">
                Cloud API token
                <input className="field mt-1" type="password" value={settings.whatsappToken} onChange={(event) => setSettings({ ...settings, whatsappToken: event.target.value })} placeholder="Leave dots to keep saved token" />
              </label>
              <label className="text-sm font-semibold">
                Phone number ID
                <input className="field mt-1" value={settings.whatsappPhoneNumberId} onChange={(event) => setSettings({ ...settings, whatsappPhoneNumberId: event.target.value })} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Template name (optional)
                  <input className="field mt-1" value={settings.whatsappTemplateName} onChange={(event) => setSettings({ ...settings, whatsappTemplateName: event.target.value })} />
                </label>
                <label className="text-sm font-semibold">
                  Template language
                  <input className="field mt-1" value={settings.whatsappLanguage} onChange={(event) => setSettings({ ...settings, whatsappLanguage: event.target.value })} placeholder="en" />
                </label>
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Manual wa.me links in Compose never need these. Auto-send needs Meta WhatsApp Cloud API credentials, or leave it off and use manual links.
              </p>
              <div className="flex justify-end">
                <button className="btn-primary inline-flex items-center gap-2" disabled={!canEditSettings || savingSettings}>
                  {savingSettings ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save gateway
                </button>
              </div>
            </div>
          </form>
        )}

        {tab === "logs" && (
          <div className="card overflow-x-auto">
            <div className="px-4 py-3 text-sm font-bold">Recent sends (100)</div>
            {logsLoading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
            ) : logs.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">No messages sent yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Channel</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3 text-right">Sent</th>
                    <th className="px-4 py-3 text-right">Failed</th>
                    <th className="px-4 py-3">By</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">{String(log.createdAt ?? "").slice(0, 16).replace("T", " ")}</td>
                      <td className="px-4 py-3 font-semibold capitalize">{log.channel}</td>
                      <td className="max-w-[420px] truncate px-4 py-3 text-muted-foreground">{log.message}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{log.sent}</td>
                      <td className={`px-4 py-3 text-right font-bold ${log.failed > 0 ? "text-red-500" : "text-muted-foreground"}`}>{log.failed}</td>
                      <td className="px-4 py-3">{log.sentByName || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </>
  );
}
