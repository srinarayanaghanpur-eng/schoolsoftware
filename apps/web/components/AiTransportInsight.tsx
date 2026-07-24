"use client";

import { Sparkles, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useAdminSession } from "./AdminSessionContext";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { adminApiRequest } from "@/lib/adminApiClient";

interface Props {
  title: string;
  prompt: string;
  data: unknown;
}

export function AiTransportInsight({ title, prompt, data }: Props) {
  const { hasPermission } = useAdminSession();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUseAi = hasPermission(AI_PERMISSIONS.CHAT);

  async function runAnalysis() {
    if (result) { setOpen(!open); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await adminApiRequest<{ ok: boolean; response: string; fromCache?: boolean }>("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          feature: "transport_insight",
          useErpData: true,
          erpContext: data,
        }),
      });
      setResult(res.response);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI analysis failed");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  if (!canUseAi) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={runAnalysis}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-[#3033a1]/20 bg-[#f4f5ff] px-4 py-2 text-sm font-bold text-[#3033a1] transition hover:bg-[#eef0ff] disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {loading ? "Analyzing..." : result ? (open ? "Hide AI Insights" : "Show AI Insights") : `AI Analysis — ${title}`}
      </button>

      {open && (
        <div className="mt-3 rounded-2xl border border-[#3033a1]/15 bg-gradient-to-br from-[#f8f9ff] to-[#f0f2ff] p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#3033a1]" />
              <span className="text-sm font-extrabold text-[#3033a1]">AI Insights</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-lg text-[#7d86a8] hover:bg-white/60">
              <X size={15} />
            </button>
          </div>
          {error ? (
            <p className="mt-3 text-sm font-semibold text-[#ed515d]">{error}</p>
          ) : result ? (
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#1f2136]">{result}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
