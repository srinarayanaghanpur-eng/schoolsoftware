"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { hasPermission } from "@sri-narayana/shared";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";

type ReportType = "monthly" | "vehicle-wise" | "pending" | "overdue" | "yearly" | "company-wise";

const REPORTS: { value: ReportType; label: string }[] = [
  { value: "monthly", label: "Monthly Bus EMI Report" },
  { value: "vehicle-wise", label: "Vehicle-wise EMI Report" },
  { value: "pending", label: "Pending EMI Report" },
  { value: "overdue", label: "Overdue EMI Report" },
  { value: "yearly", label: "Yearly EMI Paid Report" },
  { value: "company-wise", label: "Finance Company-wise Report" },
];

const prettify = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/\b\w/g, (c) => c.toUpperCase());

export default function BusFinanceReportsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const canExport = Boolean(role && hasPermission(role, "bus_finance.export"));

  const [type, setType] = useState<ReportType>("monthly");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!selectedYear?.id) {
      setRows([]);
      setError("Select an academic year to load reports.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ type, academicYearId: selectedYear.id, pageSize: "25" });
      if (type === "monthly") qs.set("month", month);
      if (type === "yearly" && year) qs.set("year", year);
      const res = await adminApiRequest<{ ok: boolean; rows: Record<string, unknown>[] }>(
        `/api/admin/bus-finance/reports?${qs.toString()}`
      );
      setRows(res.rows ?? []);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load report");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canExport) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, selectedYear?.id]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const fileBase = `bus-emi-${type}${type === "monthly" ? "-" + month : ""}${type === "yearly" ? "-" + year : ""}`;

  const exportExcel = async () => {
    if (rows.length === 0) return;
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileBase}.xlsx`);
  };

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = columns.join(",");
    const body = rows
      .map((r) => columns.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canExport) {
    return (
      <>
        <PageHeader title="Bus EMI Reports" description="Vehicle finance reports." />
        <section className="p-4 md:p-7">
          <div className="card max-w-2xl p-5 text-sm font-semibold text-[#d84d5b]">
            Your role does not have access to Bus EMI reports.
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Bus EMI Reports" description="Reports built from real EMI payment data." />
      <section className="space-y-4 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load bus EMI reports.</div>}
        <Link href="/admin/transport/bus-finance" className="inline-flex items-center gap-1 text-sm font-semibold text-[#3033a1]">
          <ArrowLeft size={16} /> Back to list
        </Link>

        <div className="card flex flex-wrap items-end gap-3 p-4 print:hidden">
          <label className="block">
            <span className="text-xs font-semibold text-[#5b6478]">Report</span>
            <select className="field mt-1" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {REPORTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          {type === "monthly" && (
            <label className="block">
              <span className="text-xs font-semibold text-[#5b6478]">Month</span>
              <input type="month" className="field mt-1" value={month} onChange={(e) => setMonth(e.target.value)} />
            </label>
          )}
          {type === "yearly" && (
            <label className="block">
              <span className="text-xs font-semibold text-[#5b6478]">Year</span>
              <input type="number" className="field mt-1" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
          )}
          <button onClick={run} className="btn-primary">Run</button>
          <div className="ml-auto flex gap-2">
            <button onClick={exportExcel} disabled={rows.length === 0} className="btn-secondary disabled:opacity-50"><FileDown size={16} /> Excel</button>
            <button onClick={exportCsv} disabled={rows.length === 0} className="btn-secondary disabled:opacity-50"><FileDown size={16} /> CSV</button>
            <button onClick={() => window.print()} disabled={rows.length === 0} className="btn-secondary disabled:opacity-50"><Printer size={16} /> Print / PDF</button>
          </div>
        </div>

        {error && <div className="card border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>}

        <div className="card overflow-hidden p-0">
          <div className="border-b border-[#edf0f7] px-5 py-3">
            <h3 className="text-sm font-bold text-[#1f2136]">{REPORTS.find((r) => r.value === type)?.label} — {rows.length} row(s)</h3>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-[#7d86a8]">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-sm text-[#7d86a8]">No data for this report.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f7f8fc] text-xs uppercase tracking-wide text-[#7d86a8]">
                  <tr>{columns.map((c) => <th key={c} className="px-4 py-3">{prettify(c)}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#edf0f7]">
                      {columns.map((c) => <td key={c} className="px-4 py-3">{String(r[c] ?? "")}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
