"use client";

import type { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  hideOnMobile?: boolean;
  className?: string;
};

export function ResponsiveFinanceTable<T>({ columns, rows, rowKey, loading, empty }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  empty?: string;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-8">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-[#f1f5f9]" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-8 text-center text-sm font-medium text-[#94a3b8]">
        {empty || "No data found."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-sm">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs font-bold uppercase text-[#64748b]">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.className || ""}`}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-t border-[#f1f5f9] hover:bg-[#f8fafc] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : ""} ${col.className || ""} ${col.hideOnMobile ? "hidden md:table-cell" : ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-[#f1f5f9] md:hidden">
        {rows.map((row) => (
          <div key={rowKey(row)} className="p-4">
            {columns.filter((c) => !c.hideOnMobile).map((col) => (
              <div key={col.key} className={`flex items-center justify-between gap-2 py-1 ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                <span className="text-xs font-semibold text-[#64748b]">{col.header}</span>
                <span className="text-sm font-medium text-[#1e293b] text-right">{col.cell(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
