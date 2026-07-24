"use client";

import { Bot, User, Copy, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  role: "user" | "assistant";
  content: string;
  copied: boolean;
  onCopy: () => void;
}

export function AIResponseCard({ role, content, copied, onCopy }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl bg-[#17217f] px-4 py-3 text-white md:max-w-[65%]">
          <div className="mb-1 flex items-center gap-2">
            <User size={14} className="shrink-0 opacity-70" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider opacity-70">You</span>
          </div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-full rounded-2xl border border-border bg-card p-4 shadow-sm md:max-w-[760px]">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0f2ff] text-[#3033a1]">
              <Bot size={15} />
            </span>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">AI Agent</span>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <CheckCircle2 size={13} className="text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy size={13} />
                Copy
              </>
            )}
          </button>
        </div>
        <div className="prose prose-sm prose-headings:text-foreground prose-strong:text-foreground prose-td:border prose-td:border-border prose-td:px-3 prose-td:py-1.5 prose-th:border prose-th:border-border prose-th:bg-muted prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-bold prose-th:uppercase prose-th:text-muted-foreground max-w-none leading-relaxed text-foreground">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
