"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAdminSession } from "@/components/AdminSessionContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import {
  MessageSquare,
  IndianRupee,
  FileText,
  BarChart3,
  Users,
  GraduationCap,
  ShieldAlert,
  Send,
  Trash2,
  Copy,
  Plus,
  Loader2,
  Bot,
  User,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type ToolItem = {
  id: string;
  label: string;
  icon: typeof Bot;
  permission: string;
};

const AI_TOOLS: ToolItem[] = [
  { id: "chat", label: "General Chat", icon: MessageSquare, permission: AI_PERMISSIONS.CHAT },
  { id: "fee_reminder", label: "Fee Reminder AI", icon: IndianRupee, permission: AI_PERMISSIONS.GENERATE_FEE_MESSAGE },
  { id: "notice", label: "Notice Generator", icon: Megaphone, permission: AI_PERMISSIONS.GENERATE_NOTICE },
  { id: "dues", label: "Dues Summary", icon: BarChart3, permission: AI_PERMISSIONS.SUMMARIZE_REPORTS },
  { id: "parent_message", label: "Parent Message Writer", icon: Users, permission: AI_PERMISSIONS.CHAT },
  { id: "teacher_message", label: "Teacher Message Writer", icon: GraduationCap, permission: AI_PERMISSIONS.CHAT },
  { id: "report", label: "Report Explainer", icon: FileText, permission: AI_PERMISSIONS.SUMMARIZE_REPORTS },
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  tool?: string;
};

export default function AiAgentPage() {
  const { hasPermission, role, permissions, loading: sessionLoading } = useAdminSession();

  const [activeTool, setActiveTool] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useErpData, setUseErpData] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [quotaMode, setQuotaMode] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!sessionLoading && hasPermission(AI_PERMISSIONS.VIEW)) {
      fetch("/api/quota/status", {
        headers: { authorization: `Bearer ${""}` },
      })
        .then((r) => r.json().catch(() => null))
        .then((res) => {
          if (res?.ok && res.data?.mode) setQuotaMode(res.data.mode);
        })
        .catch(() => {});
    }
  }, [sessionLoading]);

  const canAccessTool = (permission: string) => {
    return hasPermission(permission);
  };

  const availableTools = AI_TOOLS.filter((t) => canAccessTool(t.permission));

  const toolTitle = availableTools.find((t) => t.id === activeTool)?.label || "AI Agent";

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, tool: activeTool }]);
    setLoading(true);

    try {
      let response = "";

      if (activeTool === "notice") {
        const res = await adminApiRequest<{ ok: boolean; notice: string }>(
          "/api/ai/generate-notice",
          {
            method: "POST",
            body: JSON.stringify({
              topic: userMessage,
              language: "English",
              tone: "formal",
              target: "parents",
            }),
          }
        );
        response = res.notice;
      } else if (activeTool === "fee_reminder") {
        const res = await adminApiRequest<{ ok: boolean; message: string; variables?: Record<string, unknown>; warnings?: string[] }>(
          "/api/ai/generate-fee-message",
          {
            method: "POST",
            body: JSON.stringify({ studentId: userMessage }),
          }
        );
        response = res.message;
        if (res.warnings?.length) {
          response += "\n\n⚠️ Warnings:\n" + res.warnings.join("\n");
        }
      } else if (activeTool === "parent_message") {
        const res = await adminApiRequest<{ ok: boolean; response: string }>(
          "/api/ai/chat",
          {
            method: "POST",
            body: JSON.stringify({
              prompt: `Write a parent message about: ${userMessage}`,
              feature: "parent_message",
            }),
          }
        );
        response = res.response;
      } else if (activeTool === "teacher_message") {
        const res = await adminApiRequest<{ ok: boolean; response: string }>(
          "/api/ai/chat",
          {
            method: "POST",
            body: JSON.stringify({
              prompt: `Write a teacher message about: ${userMessage}`,
              feature: "teacher_message",
            }),
          }
        );
        response = res.response;
      } else if (activeTool === "report") {
        const res = await adminApiRequest<{ ok: boolean; response: string }>(
          "/api/ai/chat",
          {
            method: "POST",
            body: JSON.stringify({
              prompt: `Explain this report in simple English: ${userMessage}`,
              feature: "report_explainer",
            }),
          }
        );
        response = res.response;
      } else {
        const res = await adminApiRequest<{ ok: boolean; response: string }>(
          "/api/ai/chat",
          {
            method: "POST",
            body: JSON.stringify({
              prompt: userMessage,
              feature: activeTool,
              useErpData,
            }),
          }
        );
        response = res.response;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: response, tool: activeTool }]);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.message || "Something went wrong. Please try again."}`,
          tool: activeTool,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleClear() {
    setMessages([]);
  }

  async function handleCopy(index: number) {
    const text = messages[index]?.content;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      // fallback
    }
  }

  async function handleSummarizeDues() {
    setLoading(true);
    try {
      const res = await adminApiRequest<{ ok: boolean; summary: { totalStudents: number; totalDueAmount: number; classWiseSummary: Array<{ class: string; studentCount: number; totalDue: number }>; topDueCases: Array<{ studentName: string; totalDue: number }>; suggestedReminderPlan: string } }>(
        "/api/ai/summarize-dues",
        { method: "POST", body: JSON.stringify({}) }
      );
      const { summary } = res;
      let text = `📊 **Dues Summary**\n\n`;
      text += `Total students with dues: **${summary.totalStudents}**\n`;
      text += `Total due amount: **Rs ${summary.totalDueAmount.toLocaleString()}**\n\n`;
      text += `**Class-wise breakdown:**\n`;
      summary.classWiseSummary.forEach((c) => {
        text += `- ${c.class}: ${c.studentCount} students, Rs ${c.totalDue.toLocaleString()}\n`;
      });
      text += `\n**Top due cases:**\n`;
      summary.topDueCases.slice(0, 5).forEach((s, i) => {
        text += `${i + 1}. ${s.studentName}: Rs ${s.totalDue.toLocaleString()}\n`;
      });
      text += `\n**Plan:** ${summary.suggestedReminderPlan}`;

      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Summarize fee dues", tool: "dues" },
        { role: "assistant", content: text, tool: "dues" },
      ]);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error.message || "Failed to summarize dues"}`, tool: "dues" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  if (sessionLoading) {
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
              You do not have permission to access the AI Agent.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col overflow-hidden">
      <div className="border-b border-border bg-card px-4 py-3 md:px-7">
        <h1 className="text-xl font-extrabold text-foreground">AI Agent</h1>
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">
          Ask AI to generate notices, fee reminders, summaries, and parent messages
        </p>
      </div>

      {quotaMode === "saver" && (
        <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
          <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          <span className="text-xs font-semibold text-amber-800">
            Saver Mode active to protect Firebase/Gemini quota. Some AI features may be limited.
          </span>
        </div>
      )}
      {quotaMode === "emergency" && (
        <div className="flex items-center gap-3 border-b border-red-200 bg-red-50 px-4 py-2.5">
          <XCircle size={16} className="shrink-0 text-red-600" />
          <span className="text-xs font-semibold text-red-800">
            Quota protection active. Live AI is paused. Cached data is being shown.
          </span>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-3 md:block">
          <nav className="space-y-1">
            {availableTools.map((tool) => {
              const Icon = tool.icon;
              const active = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActiveTool(tool.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition ${
                    active
                      ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-muted hover:text-accent-foreground"
                  }`}
                >
                  <Icon size={16} strokeWidth={2.35} />
                  {tool.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden">
          {activeTool === "dues" && (
            <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-2.5">
              <span className="text-sm font-bold text-foreground">Fee Dues Summary</span>
              <button
                type="button"
                onClick={handleSummarizeDues}
                disabled={loading}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <BarChart3 size={14} />}
                Summarize Dues
              </button>
            </div>
          )}

          {activeTool === "fee_reminder" && (
            <div className="border-b border-border bg-muted/20 px-4 py-2.5">
              <p className="text-xs font-semibold text-muted-foreground">
                Enter a Student ID to generate a fixed fee reminder message. The system will fetch actual due amounts from the database.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <Bot size={48} className="mb-4 text-muted-foreground/40" />
                <h3 className="text-lg font-extrabold text-foreground">{toolTitle}</h3>
                <p className="mt-1 max-w-md text-sm font-medium text-muted-foreground">
                  {activeTool === "chat" && "Ask AI to generate notices, fee reminders, summaries, and parent messages."}
                  {activeTool === "fee_reminder" && "Enter a Student ID to generate a fee reminder message."}
                  {activeTool === "notice" && "Describe the notice you want to create. Include topic, audience, and tone."}
                  {activeTool === "dues" && 'Click "Summarize Dues" to get a class-wise fee due summary.'}
                  {activeTool === "parent_message" && "Describe the message you want to send to parents."}
                  {activeTool === "teacher_message" && "Describe the message you want to send to teachers."}
                  {activeTool === "report" && "Paste report data or describe what you need explained."}
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-[#17217f] text-white"
                        : "border border-border bg-card text-foreground"
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {msg.role === "user" ? (
                        <User size={14} className="shrink-0 opacity-70" />
                      ) : (
                        <Bot size={14} className="shrink-0 text-[#17217f]" />
                      )}
                      <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-70">
                        {msg.role === "user" ? "You" : "AI Agent"}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                    {msg.role === "assistant" && (
                      <div className="mt-2 flex items-center gap-2 border-t border-border/50 pt-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(idx)}
                          className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
                        >
                          {copiedIndex === idx ? (
                            <CheckCircle2 size={13} className="text-emerald-500" />
                          ) : (
                            <Copy size={13} />
                          )}
                          {copiedIndex === idx ? "Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <Loader2 size={16} className="animate-spin text-[#17217f]" />
                  <span className="text-sm font-medium text-muted-foreground">AI is thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeTool === "fee_reminder"
                      ? "Enter Student ID..."
                      : activeTool === "notice"
                      ? "Describe the notice (e.g. 'Write a notice about fee payment for parents')..."
                      : activeTool === "dues"
                      ? "Ask about dues or click Summarize Dues..."
                      : activeTool === "parent_message"
                      ? "Describe parent message..."
                      : activeTool === "teacher_message"
                      ? "Describe teacher message..."
                      : activeTool === "report"
                      ? "Paste report data or ask for explanation..."
                      : "Type your message..."
                  }
                  className="field pr-12"
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="btn-primary grid h-10 w-10 place-items-center rounded-lg p-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={messages.length === 0}
                className="btn-ghost grid h-10 w-10 place-items-center rounded-lg p-0"
                title="Clear chat"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-4">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={useErpData}
                  onChange={(e) => setUseErpData(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <span className="text-[11px] font-bold text-muted-foreground">Use ERP Data</span>
              </label>
              <span className="text-[11px] font-medium text-muted-foreground">
                {activeTool === "notice" && "Creates a formatted school notice"}
                {activeTool === "fee_reminder" && "Generates fixed template message from actual dues"}
                {activeTool === "dues" && "Summarizes fee due data from ERP"}
                {activeTool === "chat" && "General AI assistant for school tasks"}
                {activeTool === "parent_message" && "Drafts parent communication"}
                {activeTool === "teacher_message" && "Drafts teacher communication"}
                {activeTool === "report" && "Explains reports in simple English"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
