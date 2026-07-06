"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { MessageCircle, RefreshCw, Send } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Reminder = { studentId: string; name: string; className: string; phone: string; due: number };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

function sanitizePhone(raw: string): string {
  return raw.replace(/[\s\-\(\)\.\+\#\*\[\]]/g, "").replace(/^0+/, "");
}

function whatsAppUrl(phone: string, text: string): string {
  const cleaned = sanitizePhone(phone);
  const number = cleaned.length === 10 ? `91${cleaned}` : cleaned;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

function openWhatsApp(phone: string, text: string) {
  window.open(whatsAppUrl(phone, text), "_blank");
}

export default function RemindersPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const canSend = hasPermission(role, "fees.create");
  const [list, setList] = useState<Reminder[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState("sms");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [waMessage, setWaMessage] = useState("");

  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!selectedYear?.id) {
      setList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "100" });
      setList((await adminApiRequest<{ reminders: Reminder[] }>(`/api/admin/finance/reminders?${params}`)).reminders);
    }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [selectedYear?.id]);

  useEffect(() => { void load(); }, [load]);

  async function syncDues() {
    if (!selectedYear?.id) { setError("Select an academic year first."); return; }
    setSyncing(true); setError(""); setMsg("");
    try {
      const r = await adminApiRequest<{ synced: number }>("/api/admin/finance/sync-summaries", {
        method: "POST",
        body: JSON.stringify({ academicYearId: selectedYear.id })
      });
      setMsg(`Synced fee data for ${r.synced} student(s).`);
      await load();
    }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Sync failed"); }
    finally { setSyncing(false); }
  }

  function toggle(id: string) { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); }
  function toggleAll() { setSel(sel.size === list.length ? new Set() : new Set(list.map((r) => r.studentId))); }

  async function send() {
    setError(""); setMsg("");
    if (!selectedYear?.id) { setError("Select an academic year first."); return; }
    try { const r = await adminApiRequest<{ queued: number }>("/api/admin/finance/reminders", { method: "POST", body: JSON.stringify({ studentIds: [...sel], academicYearId: selectedYear.id, channel }) }); setMsg(`${r.queued} reminder(s) queued via ${channel}.`); setSel(new Set()); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to send"); }
  }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Fee Reminders" description="Notify parents of students with outstanding dues." />
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load reminder candidates.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        {msg && <div className="card border-l-4 border-l-[#14a762] p-4 text-sm font-semibold text-[#14a762]">{msg}</div>}

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold text-[#7d86a8]">{sel.size} selected of {list.length} with dues</span>
          {canSend && (
            <button className="btn-outline" onClick={syncDues} disabled={syncing} title="Rebuild dues list from student records">
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} /> {syncing ? "Syncing…" : "Sync dues"}
            </button>
          )}
          <select className="field ml-auto max-w-[160px]" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select>
          <button className="btn-primary" disabled={sel.size === 0 || !canSend} onClick={send}><Send size={16} /> Send reminders</button>
          {sel.size > 0 && (
            <span className="flex gap-2 border-l border-stone-300 pl-3">
              <button className="btn-outline" onClick={() => { list.filter((r) => sel.has(r.studentId) && r.phone).forEach((r) => openWhatsApp(r.phone, waMessage || `Dear Parent, your child ${r.name} has a fee balance of ${inr(r.due)}. Please clear the dues at your earliest.`)); }} disabled={!waMessage.trim() && !sel.size}><MessageCircle size={16} /> Send WhatsApp One-by-One</button>
              <button className="btn-outline" onClick={async () => { const links = list.filter((r) => sel.has(r.studentId) && r.phone).map((r) => whatsAppUrl(r.phone, waMessage || `Dear Parent, your child ${r.name} has a fee balance of ${inr(r.due)}. Please clear the dues at your earliest.`)); try { await navigator.clipboard.writeText(links.join("\n")); setMsg("WhatsApp links copied!"); } catch { setError("Failed to copy links"); } }} disabled={sel.size === 0}><MessageCircle size={16} /> Copy WhatsApp Links</button>
              <button className="btn-outline" onClick={() => { const links = list.filter((r) => sel.has(r.studentId) && r.phone).map((r) => `${r.name}\t${r.phone}\t${whatsAppUrl(r.phone, waMessage || `Dear Parent, your child ${r.name} has a fee balance of ${inr(r.due)}. Please clear the dues at your earliest.`)}`).join("\n"); const blob = new Blob([`Name\tPhone\tWhatsApp Link\n${links}`], { type: "text/csv" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "whatsapp-links.csv"; a.click(); URL.revokeObjectURL(url); }} disabled={sel.size === 0}><MessageCircle size={16} /> Export WhatsApp Links</button>
            </span>
          )}
        </div>
        <textarea className="field w-full max-w-2xl" rows={2} placeholder="Compose WhatsApp message… (optional — uses default if empty)" value={waMessage} onChange={(e) => setWaMessage(e.target.value)} />

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3"><input type="checkbox" checked={list.length > 0 && sel.size === list.length} onChange={toggleAll} /></th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3 text-right">Due</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
              : list.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No students with dues 🎉</td></tr>
              : list.map((r) => (
                <tr key={r.studentId} className="border-t border-stone-100">
                  <td className="px-4 py-3"><input type="checkbox" checked={sel.has(r.studentId)} onChange={() => toggle(r.studentId)} /></td>
                  <td className="px-4 py-3 font-semibold text-[#303247]">{r.name}</td><td className="px-4 py-3">{r.className}</td><td className="px-4 py-3 text-stone-500">{r.phone ? <span className="inline-flex items-center gap-2">{r.phone} <button className="btn-text text-xs" title="Send via WhatsApp" onClick={() => openWhatsApp(r.phone, waMessage || `Dear Parent, your child ${r.name} has a fee balance of ${inr(r.due)}. Please clear the dues at your earliest.`)}><MessageCircle size={14} /> WhatsApp</button></span> : "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#e29813]">{inr(r.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
