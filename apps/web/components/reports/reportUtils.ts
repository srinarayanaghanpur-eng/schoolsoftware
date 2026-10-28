export type ReportRow = Record<string, unknown>;

const AMOUNT_KEY = /amount|paid|due|fee|total|collected|outstanding|balance|loan|emi|profit|income|expense|salary|deduction|bonus|net|pending|overdue|receivable|payable|advance/i;
const COUNT_KEY = /count|students|transactions|days|emis|loans/i;
const SKIP_TOTAL_KEY = /percentage|percent|share|number|id|month|year|date|status|mode|class|section|name|company|vehicle|average/i;

export function prettifyKey(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase())
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function isAmountColumn(key: string) {
  return AMOUNT_KEY.test(key) && !/percentage|percent|share|number|count|emis|loans|students|transactions|days|by/i.test(key);
}

export function isCountColumn(key: string) {
  return COUNT_KEY.test(key) && !/percentage|percent|share|number|id/i.test(key);
}

export function isSummableColumn(key: string) {
  if (SKIP_TOTAL_KEY.test(key)) return false;
  return isAmountColumn(key) || isCountColumn(key);
}

function dateValue(value: unknown) {
  if (value && typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return null;
}

export function normalizeRows(rows: ReportRow[]): ReportRow[] {
  return rows.map((row) => {
    const next: ReportRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) {
        next[key] = "";
        continue;
      }
      if (Array.isArray(value) || typeof value === "object") {
        const date = dateValue(value);
        if (date) next[key] = date;
        continue;
      }
      next[key] = value;
    }
    return next;
  });
}

export function columnsFor(rows: ReportRow[]) {
  return rows.length > 0 ? Object.keys(rows[0]) : [];
}

export function displayValue(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (isAmountColumn(key)) return `₹${value.toLocaleString("en-IN")}`;
    if (/percentage|percent|share/i.test(key)) return `${value.toLocaleString("en-IN")}%`;
    return value.toLocaleString("en-IN");
  }
  if (typeof value === "string" && /percentage|percent|share/i.test(key) && value.trim() !== "") {
    return `${value}%`;
  }
  return String(value);
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsv(rows: ReportRow[], fileName: string) {
  const normalized = normalizeRows(rows);
  if (normalized.length === 0) return;
  const columns = columnsFor(normalized);
  const csv = [
    columns.map((column) => csvCell(prettifyKey(column))).join(","),
    ...normalized.map((row) => columns.map((column) => csvCell(row[column])).join(","))
  ].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadExcel(rows: ReportRow[], fileName: string, sheetName = "Report") {
  const normalized = normalizeRows(rows);
  if (normalized.length === 0) return;
  const XLSX = await import("xlsx");
  const columns = columnsFor(normalized);
  const exportRows = normalized.map((row) =>
    Object.fromEntries(columns.map((column) => [prettifyKey(column), row[column]]))
  );
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function printReport(title: string, rows: ReportRow[], meta = "") {
  const normalized = normalizeRows(rows);
  if (normalized.length === 0) return;
  const columns = columnsFor(normalized);
  const tableRows = normalized
    .map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(displayValue(row[column], column))}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <link rel="stylesheet" href="/globals.css">
      </head>
      <body class="print-report-body">
        <h1 class="print-report-title">${escapeHtml(title)}</h1>
        <p class="print-report-meta">Sri Narayana High School · Powered by NarayanaOS · Generated ${new Date().toLocaleString()}${meta ? ` · ${escapeHtml(meta)}` : ""}</p>
        <table class="print-report-table">
          <thead><tr>${columns.map((column) => `<th>${escapeHtml(prettifyKey(column))}</th>`).join("")}</tr></thead>
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
