"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, Loader2, Bot } from "lucide-react";
import { AIResponseCard } from "./AIResponseCard";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tool?: string;
}

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  activeTool: string;
  toolTitle: string;
  onSend: () => void;
  onInputChange: (value: string) => void;
  onClear: () => void;
  placeholders: Record<string, string>;
}

export function AIChatPanel({
  messages,
  loading,
  input,
  activeTool,
  toolTitle,
  onSend,
  onInputChange,
  onClear,
  placeholders,
}: Props) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  async function handleCopy(index: number) {
    const text = messages[index]?.content;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch { /* fallback */ }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
              <Bot size={48} className="mb-4 text-muted-foreground/30" />
              <h3 className="text-lg font-extrabold text-foreground">{toolTitle}</h3>
              <p className="mt-1 max-w-md text-sm font-medium text-muted-foreground">
                {placeholders[activeTool] || "Ask AI a question..."}
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <AIResponseCard
                key={idx}
                role={msg.role}
                content={msg.content}
                copied={copiedIndex === idx}
                onCopy={() => handleCopy(idx)}
              />
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                <Loader2 size={16} className="animate-spin text-[#17217f]" />
                <span className="text-sm font-medium text-muted-foreground">AI is thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-border bg-card px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholders[activeTool] || "Type your message..."}
              className="field rounded-2xl pr-12"
              disabled={loading}
            />
          </div>
          <button
            type="button"
            onClick={onSend}
            disabled={loading || !input.trim()}
            className="btn-primary grid h-10 w-10 shrink-0 place-items-center rounded-xl p-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={messages.length === 0}
            className="btn-ghost grid h-10 w-10 shrink-0 place-items-center rounded-xl p-0"
            title="Clear chat"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
