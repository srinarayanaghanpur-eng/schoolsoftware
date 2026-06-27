"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";

type Reminder = { studentId: string; name: string; className: string; phone: string; due: number };
function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

export default function RemindersPage() {
  const { role } = useAdminSession();
  const canSend = hasPermission(role, "fees.create");
  const [list, setList] = useState<Reminder[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [channel, setChannel] = useState("sms");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setList((await adminApiRequest<{ reminders: Reminder[] }>("/api/admin/finance/reminders")).reminders); }
      catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
      finally { setLoading(false); }
    })();
  }, []);

  function toggle(id: string) { const n = new Set(sel); n.has(id) ? n.delete(id) : n.add(id); setSel(n); }
  function toggleAll() { setSel(sel.size === list.length ? new Set() : new Set(list.map((r) => r.studentId))); }

  async function send() {
    setError(""); setMsg("");
    try { const r = await adminApiRequest<{ queued: number }>("/api/admin/finance/reminders", { method: "POST", body: JSON.stringify({ studentIds: [...sel], channel }) }); setMsg(`${r.queued} reminder(s) queued via ${channel}.`); setSel(new Set()); }
    catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to send"); }
  }

  if (!hasPermission(role, "fees.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Fee Reminders" description="Notify parents of students with outstanding dues." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}
        {msg && <div className="card border-l-4 border-l-[#14a762] p-4 text-sm font-semibold text-[#14a762]">{msg}</div>}

        <div className="card flex flex-wrap items-center gap-3 p-4">
          <span className="text-sm font-semibold text-[#7d86a8]">{sel.size} selected of {list.length} with dues</span>
          <select className="field ml-auto max-w-[160px]" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option></select>
          <button className="btn-primary" disabled={sel.size === 0 || !canSend} onClick={send}><Send size={16} /> Send reminders</button>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500"><tr><th className="px-4 py-3"><input type="checkbox" checked={list.length > 0 && sel.size === list.length} onChange={toggleAll} /></th><th className="px-4 py-3">Student</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3 text-right">Due</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">Loading…</td></tr>
              : list.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No students with dues 🎉</td></tr>
              : list.map((r) => (
                <tr key={r.studentId} className="border-t border-stone-100">
                  <td className="px-4 py-3"><input type="checkbox" checked={sel.has(r.studentId)} onChange={() => toggle(r.studentId)} /></td>
                  <td className="px-4 py-3 font-semibold text-[#303247]">{r.name}</td><td className="px-4 py-3">{r.className}</td><td className="px-4 py-3 text-stone-500">{r.phone || "—"}</td>
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
