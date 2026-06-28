"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { MessageSquare, Reply, SendHorizonal } from "lucide-react";
import { useEffect, useState } from "react";

type Message = {
  id: string;
  parentUid: string;
  parentName?: string;
  studentId: string;
  studentName?: string;
  type: string;
  subject: string;
  body: string;
  status: string;
  reply?: string;
  repliedBy?: string;
  repliedAt?: string;
  createdAt: string;
};

const STATUS_TABS = ["open", "in_progress", "resolved", "all"] as const;
const TYPE_LABELS: Record<string, string> = { enquiry: "Enquiry", support_ticket: "Support", complaint: "Complaint", meeting_request: "Meeting" };
const STATUS_TONES: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700"
};

export default function MessagesPage() {
  const { role } = useAdminSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("open");
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<string>("resolved");

  async function load() {
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const data = await adminApiRequest<{ messages: Message[] }>(`/api/admin/messages${params}`);
      setMessages(data.messages);
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to load"); }
  }
  useEffect(() => { void load(); }, [filter]);

  async function submitReply(id: string) {
    if (!replyText.trim()) return;
    setError("");
    try {
      await adminApiRequest(`/api/admin/messages/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: replyStatus, reply: replyText.trim() })
      });
      setReplying(null);
      setReplyText("");
      await load();
    } catch (e) { setError(e instanceof AdminApiError ? e.message : "Failed to send reply"); }
  }

  if (!hasPermission(role, "communication.view")) return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;

  return (
    <>
      <PageHeader title="Parent Messages" description="View and respond to messages from parents." />
      <section className="space-y-4 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="flex gap-2 border-b border-[#e4e6f0]">
          {STATUS_TABS.map((tab) => (
            <button key={tab} onClick={() => setFilter(tab)}
              className={`px-4 py-2.5 text-sm font-bold transition border-b-2 -mb-px capitalize ${
                filter === tab ? "border-[#4748a9] text-[#4748a9]" : "border-transparent text-[#7d86a8] hover:text-[#4748a9]"
              }`}>{tab.replace("_", " ")}</button>
          ))}
        </div>

        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="card p-8 text-center text-sm text-stone-400">No messages found.</div>
          ) : messages.map((m) => (
            <div key={m.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-lg bg-[#eef0ff] px-2.5 py-1 text-xs font-bold text-[#3033a1]">{TYPE_LABELS[m.type] ?? m.type}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${STATUS_TONES[m.status] ?? "bg-stone-100 text-stone-600"}`}>{m.status.replace("_", " ")}</span>
                    {m.createdAt && <span className="text-xs text-[#7d86a8]">{new Date(m.createdAt).toLocaleDateString()}</span>}
                  </div>
                  <h3 className="mt-2 font-bold text-[#1f2136]">{m.subject}</h3>
                  <p className="mt-1 text-sm text-[#475067] whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-xs text-[#7d86a8]">
                    From: {m.parentName ?? m.parentUid}
                    {m.studentName && <span> · Student: {m.studentName}</span>}
                  </p>

                  {m.reply && (
                    <div className="mt-3 rounded-xl bg-[#f5f6fd] p-3">
                      <p className="text-xs font-bold text-[#5d6690]">Your reply:</p>
                      <p className="mt-1 text-sm text-[#303247]">{m.reply}</p>
                    </div>
                  )}
                </div>
              </div>

              {replying === m.id ? (
                <div className="mt-3 space-y-2">
                  <textarea className="field min-h-[80px]" placeholder="Type your reply..." value={replyText} onChange={(e) => setReplyText(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <select className="field w-36 text-sm" value={replyStatus} onChange={(e) => setReplyStatus(e.target.value)}>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="open">Reopen</option>
                    </select>
                    <button className="btn-primary text-xs" onClick={() => submitReply(m.id)} disabled={!replyText.trim()}>
                      <SendHorizonal size={14} /> Send reply
                    </button>
                    <button className="rounded-lg border border-[#e0e3f0] px-3 py-1.5 text-xs font-bold" onClick={() => setReplying(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <button className="rounded-lg bg-[#eef0ff] px-3 py-1.5 text-xs font-bold text-[#3033a1] hover:bg-[#e0e3ff]" onClick={() => { setReplying(m.id); setReplyText(""); setReplyStatus("resolved"); }}>
                    <Reply size={13} /> {m.reply ? "Edit reply" : "Reply"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
