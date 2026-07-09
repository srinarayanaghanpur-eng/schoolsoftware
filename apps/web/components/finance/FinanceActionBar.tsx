"use client";

import type { ReactNode } from "react";

export function FinanceActionBar({ actions }: { actions: { label: string; icon: ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onClick}
          disabled={a.disabled}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-95 min-h-[44px] ${
            a.primary
              ? "bg-[#2563eb] text-white shadow-sm hover:bg-[#1d4ed8] disabled:opacity-50"
              : "border border-[#e2e8f0] bg-white text-[#1e293b] hover:bg-[#f8fafc] disabled:opacity-50"
          }`}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}
