"use client";

import { Bot } from "lucide-react";

interface ToolItem {
  id: string;
  label: string;
  icon: typeof Bot;
  permission: string;
}

interface Props {
  tools: ToolItem[];
  activeTool: string;
  onSelect: (id: string) => void;
}

export function AIToolSidebar({ tools, activeTool, onSelect }: Props) {
  return (
    <>
      <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-card p-3 md:block">
        <nav className="space-y-0.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelect(tool.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-bold transition-all ${
                  active
                    ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted hover:text-accent-foreground"
                }`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-background ring-1 ring-border/50">
                  <Icon size={16} strokeWidth={2.35} />
                </span>
                {tool.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <div className="overflow-x-auto border-b border-border bg-card md:hidden">
        <div className="flex gap-1 p-2">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelect(tool.id)}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-accent text-accent-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon size={14} strokeWidth={2.35} />
                {tool.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
