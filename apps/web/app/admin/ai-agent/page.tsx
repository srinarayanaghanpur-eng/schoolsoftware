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
  Bot,
  Megaphone,
  AlertTriangle,
  XCircle,
  Loader2,
  X,
  Sparkles,
} from "lucide-react";
import { AIToolSidebar } from "@/components/ai/AIToolSidebar";
import { AIChatPanel } from "@/components/ai/AIChatPanel";
import { DuesSummaryPanel } from "@/components/ai/DuesSummaryPanel";

interface ToolItem {
  id: string;
  label: string;
  icon: typeof Bot;
  permission: string;
}

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

interface DuesSummaryData {
  totalStudents: number;
  totalDueAmount: number;
  classWiseSummary: Array<{ class: string; studentCount: number; totalDue: number }>;
  topDueCases: Array<{ studentName: string; totalDue: number }>;
  suggestedReminderPlan: string;
  summaryUpdatedAt?: string | null;
}

const PLACEHOLDERS: Record<string, string> = {
  chat: "Ask AI about notices, summaries, or ERP help...",
  fee_reminder: "Enter a Student ID to generate a fee reminder...",
  notice: "Describe the notice you want to generate...",
  dues: "Ask about dues or click Summarize Dues...",
  parent_message: "Describe the parent message you want to write...",
  teacher_message: "Describe the teacher message you want to write...",
  report: "Paste report data or ask for explanation...",
};

const TOOL_DESCRIPTIONS: Record<string, string> = {
  chat: "General AI assistant with live ERP data context",
  fee_reminder: "Generated fixed template message from actual dues",
  notice: "Creates a formatted school notice with live ERP context",
  dues: "Summarizes fee due data from ERP",
  parent_message: "Drafts parent communication with ERP context",
  teacher_message: "Drafts teacher communication with ERP context",
  report: "Explains reports in simple English with ERP data",
};

export default function AiAgentPage() {
  const { hasPermission, loading: sessionLoading } = useAdminSession();

  const [activeTool, setActiveTool] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quotaMode, setQuotaMode] = useState<string | null>(null);
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Dues Summary state
  const [duesData, setDuesData] = useState<DuesSummaryData | null>(null);
  const [duesLoading, setDuesLoading] = useState(false);
  const [duesError, setDuesError] = useState<string | null>(null);

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

  const availableTools = AI_TOOLS.filter((t) => hasPermission(t.permission));
  const toolTitle = availableTools.find((t) => t.id === activeTool)?.label || "AI Agent";

  async function fetchErpContext(): Promise<string | undefined> {
    try {
      const res = await adminApiRequest<{ ok: boolean; data: Record<string, unknown> }>("/api/ai/context");
      if (res.ok && res.data) return JSON.stringify(res.data, null, 2);
    } catch { /* optional */ }
    return undefined;
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage, tool: activeTool }]);
    setLoading(true);

    try {
      const erpContext = await fetchErpContext();
      let response = "";

      if (activeTool === "notice") {
        const res = await adminApiRequest<{ ok: boolean; notice: string }>("/api/ai/generate-notice", {
          method: "POST",
          body: JSON.stringify({ topic: userMessage, language: "English", tone: "formal", target: "parents" }),
        });
        response = res.notice;
      } else if (activeTool === "fee_reminder") {
        const res = await adminApiRequest<{ ok: boolean; message: string; warnings?: string[] }>(
          "/api/ai/generate-fee-message",
          { method: "POST", body: JSON.stringify({ studentId: userMessage }) }
        );
        response = res.message;
        if (res.warnings?.length) response += "\n\n⚠️ Warnings:\n" + res.warnings.join("\n");
      } else if (activeTool === "parent_message") {
        const res = await adminApiRequest<{ ok: boolean; response: string }>("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ prompt: `Write a parent message about: ${userMessage}`, feature: "parent_message" }),
        });
        response = res.response;
      } else if (activeTool === "teacher_message") {
        const res = await adminApiRequest<{ ok: boolean; response: string }>("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ prompt: `Write a teacher message about: ${userMessage}`, feature: "teacher_message" }),
        });
        response = res.response;
      } else if (activeTool === "report") {
        const res = await adminApiRequest<{ ok: boolean; response: string }>("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ prompt: `Explain this report in simple English: ${userMessage}`, feature: "report_explainer" }),
        });
        response = res.response;
      } else {
        const res = await adminApiRequest<{ ok: boolean; response: string }>("/api/ai/chat", {
          method: "POST",
          body: JSON.stringify({ prompt: userMessage, feature: activeTool, useErpData: true, erpContext }),
        });
        response = res.response;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: response, tool: activeTool }]);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error.message || "Something went wrong."}`, tool: activeTool },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
  }

  async function handleSummarizeDues() {
    setDuesLoading(true);
    setDuesError(null);
    setDuesData(null);
    try {
      const res = await adminApiRequest<{ ok: boolean; summary: DuesSummaryData; mode?: string }>(
        "/api/ai/summarize-dues",
        { method: "POST", body: JSON.stringify({}) }
      );
      setDuesData(res.summary);
    } catch (err: unknown) {
      const error = err as { message?: string; mode?: string };
      if (error.message?.includes("Access denied")) {
        setDuesError("Access denied: Your role does not have AI Agent permission.");
      } else if (error.message?.includes("Gemini API key")) {
        setDuesError("Gemini API key is not configured. Add it in AI Settings.");
      } else if (error.mode === "saver" || error.message?.includes("Saver")) {
        setDuesError("Quota saver mode is active. Showing cached summary if available.");
      } else {
        setDuesError(error.message || "Failed to summarize dues. Try again later.");
      }
    } finally {
      setDuesLoading(false);
    }
  }

  function handleToolSelect(toolId: string) {
    setActiveTool(toolId);
    if (toolId !== "dues") {
      setDuesData(null);
      setDuesError(null);
    }
  }

  const rightPanelTips: Record<string, string[]> = {
    chat: ["Ask about fee dues", "Generate notices", "Get report summaries", "Draft communications"],
    fee_reminder: ["Enter a valid Student ID", "Reminder includes actual due amount", "Uses fixed template format"],
    notice: ["Specify topic clearly", "Choose tone (formal/simple)", "Target: parents/students/teachers"],
    dues: ["Click Summarize Dues to start", "Data comes from ERP records", "No Gemini call for calculations"],
    parent_message: ["Describe the situation", "Include any specific details", "Message stays professional"],
    teacher_message: ["Clear and concise topic", "Include date/time if applicable", "Signed as Administration"],
    report: ["Paste report numbers", "Ask for trends", "Request actionable insights"],
  };

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
              Your role does not have AI Agent permission. Ask super admin to enable <strong>ai_agent.view</strong> and related AI permissions for your role.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 md:px-7">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">AI Agent</h1>
          <p className="mt-0.5 text-sm font-medium text-muted-foreground">
            Ask AI to generate notices, fee reminders, summaries, and parent messages
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRightPanel((v) => !v)}
          className="btn-ghost hidden h-8 w-8 place-items-center rounded-lg p-0 text-muted-foreground lg:grid"
          title="Toggle tips panel"
        >
          <Sparkles size={15} />
        </button>
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

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <AIToolSidebar tools={availableTools} activeTool={activeTool} onSelect={handleToolSelect} />

        {/* Center workspace */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {activeTool === "dues" ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-3 md:px-6">
                <div>
                  <h2 className="text-base font-extrabold text-foreground">Fee Dues Summary</h2>
                  <p className="text-xs font-medium text-muted-foreground">Summarizes fee due data from ERP</p>
                </div>
                <button
                  type="button"
                  onClick={handleSummarizeDues}
                  disabled={duesLoading}
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold shadow-sm"
                >
                  {duesLoading ? <Loader2 size={15} className="animate-spin" /> : <BarChart3 size={15} />}
                  {duesLoading ? "Summarizing..." : "Summarize Dues"}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                <div className="mx-auto max-w-5xl">
                  <DuesSummaryPanel
                    data={duesData}
                    loading={duesLoading}
                    error={duesError}
                    onSummarize={handleSummarizeDues}
                  />
                </div>
              </div>
            </div>
          ) : activeTool === "fee_reminder" ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="border-b border-border bg-muted/20 px-4 py-2.5 md:px-6">
                <p className="text-xs font-semibold text-muted-foreground">
                  Enter a Student ID to generate a fixed fee reminder message. The system will fetch actual due amounts from the database.
                </p>
              </div>
              <AIChatPanel
                messages={messages}
                loading={loading}
                input={input}
                activeTool={activeTool}
                toolTitle={toolTitle}
                onSend={handleSend}
                onInputChange={setInput}
                onClear={handleClear}
                placeholders={PLACEHOLDERS}
              />
            </div>
          ) : (
            <AIChatPanel
              messages={messages}
              loading={loading}
              input={input}
              activeTool={activeTool}
              toolTitle={toolTitle}
              onSend={handleSend}
              onInputChange={setInput}
              onClear={handleClear}
              placeholders={PLACEHOLDERS}
            />
          )}
        </div>

        {/* Right context panel - desktop only */}
        {showRightPanel && (
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-l border-border bg-card p-4 lg:block">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Quick Tips</h3>
              <button type="button" onClick={() => setShowRightPanel(false)} className="text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {(rightPanelTips[activeTool] || rightPanelTips.chat).map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs font-medium text-muted-foreground">
                  <span className="mt-1 grid h-1.5 w-1.5 shrink-0 rounded-full bg-[#3033a1]/40" />
                  {tip}
                </li>
              ))}
            </ul>
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Active Tool</h3>
              <p className="mt-2 text-sm font-bold text-foreground">{toolTitle}</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{TOOL_DESCRIPTIONS[activeTool] || ""}</p>
            </div>
            {quotaMode && (
              <div className="mt-6 border-t border-border pt-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Quota Status</h3>
                <p className="mt-2 text-xs font-semibold text-amber-600 capitalize">{quotaMode} mode</p>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
