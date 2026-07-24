"use client";

import { type ReactNode } from "react";

export function FinanceShell({ children, title, description, action }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="w-full max-w-full min-w-0 space-y-5 overflow-hidden px-4 py-4 sm:px-6 lg:px-8 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-[#1e293b] truncate">{title}</h1>
          {description && <p className="mt-1 text-sm font-medium text-[#64748b]">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}
