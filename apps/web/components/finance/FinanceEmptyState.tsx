"use client";

import type { ReactNode } from "react";

export function FinanceEmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#e2e8f0] bg-white p-10 text-center shadow-sm">
      <span className="text-[#cbd5e1]">{icon}</span>
      <h3 className="text-base font-extrabold text-[#1e293b]">{title}</h3>
      {description && <p className="text-sm font-medium text-[#64748b] max-w-md">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
