"use client";

import type { ReactNode } from "react";

export function FinanceStatCard({ icon, label, value, subtext, bgClass = "bg-white", borderClass = "border-[#e2e8f0]" }: {
  icon: ReactNode;
  label: string;
  value: string;
  subtext?: string;
  bgClass?: string;
  borderClass?: string;
}) {
  return (
    <div className={`rounded-2xl border ${borderClass} ${bgClass} p-4 shadow-sm`}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80 text-[#2563eb] shadow-sm">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">{label}</p>
          <p className="mt-0.5 truncate text-xl font-extrabold text-[#1e293b]">{value}</p>
          {subtext && <p className="mt-0.5 text-xs font-medium text-[#94a3b8]">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}
