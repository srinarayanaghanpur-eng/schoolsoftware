"use client";

import {
  type AttendanceRecord,
  type BiometricLog,
  type SalaryReport,
  type Teacher
} from "@sri-narayana/shared";
import {
  buildBiometricLogRows,
  buildDailyAttendanceRows,
  buildMonthlyAttendanceRows,
  buildSalaryRows
} from "@sri-narayana/shared/services/reports";
import { Download, FileText } from "lucide-react";
import { useState } from "react";

async function downloadRows(rows: Record<string, unknown>[], sheetName: string, fileName: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openPrintableReport(title: string, rows: Record<string, unknown>[]) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const tableRows = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #1c1917; margin: 24px; }
          h1 { font-size: 22px; margin: 0 0 6px; }
          p { color: #57534e; margin: 0 0 18px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #d6d3d1; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #f5f5f4; }
          @media print { body { margin: 12mm; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <p>SRI NARAYANA HIGH SCHOOL · Generated ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
        <script>window.addEventListener("load", () => window.print());</script>
      </body>
    </html>`;
  const reportWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!reportWindow) return;
  reportWindow.document.write(html);
  reportWindow.document.close();
}

export function ExportButtons({
  attendance,
  teachers,
  salaryReports,
  biometricLogs = []
}: {
  attendance: AttendanceRecord[];
  teachers: Teacher[];
  salaryReports: SalaryReport[];
  biometricLogs?: BiometricLog[];
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const runDownload = async (key: string, rows: Record<string, unknown>[], sheetName: string, fileName: string) => {
    setDownloading(key);
    try {
      await downloadRows(rows, sheetName, fileName);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-secondary" disabled={Boolean(downloading)} onClick={() => runDownload("daily", buildDailyAttendanceRows(attendance, teachers), "Daily", "daily-attendance.xlsx")}>
        <Download size={16} /> {downloading === "daily" ? "Preparing..." : "Daily"}
      </button>
      <button className="btn-secondary" onClick={() => openPrintableReport("Daily attendance report", buildDailyAttendanceRows(attendance, teachers))}>
        <FileText size={16} /> Daily PDF
      </button>
      <button className="btn-secondary" disabled={Boolean(downloading)} onClick={() => runDownload("monthly", buildMonthlyAttendanceRows(attendance, teachers), "Monthly", "monthly-attendance.xlsx")}>
        <Download size={16} /> {downloading === "monthly" ? "Preparing..." : "Monthly"}
      </button>
      <button className="btn-secondary" onClick={() => openPrintableReport("Monthly attendance report", buildMonthlyAttendanceRows(attendance, teachers))}>
        <FileText size={16} /> Monthly PDF
      </button>
      <button className="btn-secondary" disabled={Boolean(downloading)} onClick={() => runDownload("salary", buildSalaryRows(salaryReports), "Salary", "salary-report.xlsx")}>
        <Download size={16} /> {downloading === "salary" ? "Preparing..." : "Salary"}
      </button>
      <button className="btn-secondary" onClick={() => openPrintableReport("Salary report", buildSalaryRows(salaryReports))}>
        <FileText size={16} /> Salary PDF
      </button>
      <button className="btn-secondary" disabled={Boolean(downloading)} onClick={() => runDownload("biometric", buildBiometricLogRows(biometricLogs), "Biometric", "biometric-logs.xlsx")}>
        <Download size={16} /> {downloading === "biometric" ? "Preparing..." : "Biometric"}
      </button>
      <button className="btn-secondary" onClick={() => openPrintableReport("Biometric log report", buildBiometricLogRows(biometricLogs))}>
        <FileText size={16} /> Biometric PDF
      </button>
    </div>
  );
}
