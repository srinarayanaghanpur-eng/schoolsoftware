"use client";

import { type ReactNode } from "react";

export function FinanceShell({ children, title, description, action }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-5 p-4 md:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[#1e293b]">{title}</h1>
          {description && <p className="mt-1 text-sm font-medium text-[#64748b]">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}
