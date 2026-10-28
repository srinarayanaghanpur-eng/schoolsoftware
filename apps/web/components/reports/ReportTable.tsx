"use client";

import { AlertTriangle, Download, FileDown, FileText, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  columnsFor,
  displayValue,
  downloadCsv,
  downloadExcel,
  isAmountColumn,
  isSummableColumn,
  normalizeRows,
  prettifyKey,
  printReport,
  type ReportRow
} from "@/components/reports/reportUtils";

export function ReportTable({
  title,
  rows,
  meta = "",
  loading = false,
  error = "",
  truncated = false,
  emptyText = "No data for the selected filters."
}: {
  title: string;
  rows: ReportRow[];
  meta?: string;
  loading?: boolean;
  error?: string;
  truncated?: boolean;
  emptyText?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const normalized = useMemo(() => normalizeRows(rows), [rows]);
  const columns = useMemo(() => columnsFor(normalized), [normalized]);
  const totals = useMemo(() => {
    const next: Record<string, number> = {};
    for (const column of columns) {
      if (!isSummableColumn(column)) continue;
      const total = normalized.reduce((sum, row) => {
        const value = Number(row[column]);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0);
      if (total !== 0) next[column] = total;
    }
    return next;
  }, [columns, normalized]);
  const totalColumns = Object.keys(totals);
  const fileBase = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";

  async function exportExcel() {
    setDownloading(true);
    try {
      await downloadExcel(normalized, fileBase, title.slice(0, 31));
    } finally {
      setDownloading(false);
    }
  }

  if (error) {
    return <div className="card border-l-4 border-[#d84d5b] p-4 text-sm font-semibold text-[#d84d5b]">{error}</div>;
  }

  if (loading) {
    return (
      <div className="card flex items-center justify-center gap-3 p-10 text-sm font-semibold text-[#7d86a8]">
        <Loader2 className="animate-spin" size={18} /> Generating report...
      </div>
    );
  }

  if (normalized.length === 0) {
    return <div className="card p-10 text-center text-sm font-medium text-[#7d86a8]">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <button type="button" className="btn-secondary" onClick={() => downloadCsv(normalized, fileBase)}>
          <FileDown size={16} /> CSV
        </button>
        <button type="button" className="btn-secondary" onClick={exportExcel} disabled={downloading}>
          <Download size={16} /> {downloading ? "Preparing..." : "Excel"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => printReport(title, normalized, meta)}>
          <FileText size={16} /> PDF
        </button>
        <span className="ml-auto text-xs font-semibold text-[#7d86a8]">{normalized.length} row(s)</span>
      </div>

      {truncated && (
        <div className="flex items-start gap-2 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm font-semibold text-[#a16207] print:hidden">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" />
          This report reached the API row limit. Narrow the filters or export before the limit to avoid missing rows.
        </div>
      )}

      <div className="print-area card overflow-hidden p-0">
        <div className="border-b border-[#edf0f7] px-5 py-4">
          <h3 className="text-base font-extrabold text-[#1f2136]">{title}</h3>
          <p className="mt-1 text-xs font-medium text-[#7d86a8]">
            Sri Narayana High School · Generated {new Date().toLocaleString()}
            {meta ? ` · ${meta}` : ""}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-[#f7f8fd]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">
                    {prettifyKey(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalized.map((row, index) => (
                <tr key={index} className="border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff]">
                  {columns.map((column) => (
                    <td
                      key={column}
                      className={`px-4 py-3 font-medium text-[#303247] ${isAmountColumn(column) ? "text-right tabular-nums" : ""}`}
                    >
                      {displayValue(row[column], column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totalColumns.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-[#d8ddea] bg-[#f7f8fd] font-extrabold text-[#1f2136]">
                  {columns.map((column, index) => (
                    <td key={column} className={`px-4 py-3 ${isAmountColumn(column) ? "text-right tabular-nums" : ""}`}>
                      {index === 0 && !totalColumns.includes(column)
                        ? "Total"
                        : totals[column] !== undefined
                          ? displayValue(totals[column], column)
                          : ""}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
