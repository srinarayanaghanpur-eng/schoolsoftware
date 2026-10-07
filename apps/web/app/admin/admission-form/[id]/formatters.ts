// Pure value/date/document formatting helpers (extracted from page.tsx).
import type { StudentData } from "./form-types";

export function resolveValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  return "";
}

export function display(value: unknown): string {
  return resolveValue(value) || "—";
}

export function extractDate(
  value: unknown
): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as { _seconds?: number; _nanoseconds?: number };
    if (typeof obj._seconds === "number") {
      return new Date(obj._seconds * 1000 + (obj._nanoseconds ?? 0) / 1e6);
    }
  }
  const str = String(value).trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: unknown): string {
  const d = extractDate(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function formatDateTime(value: unknown): string {
  const d = extractDate(value);
  if (!d) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
}

export function previousSchoolName(student: StudentData): string {
  if (typeof student.previousSchool === "string") return student.previousSchool;
  return student.previousSchool?.name ?? "";
}

export function previousSchoolValue(
  student: StudentData,
  key: "lastClass" | "tcNo"
): string {
  if (typeof student.previousSchool === "string") return "";
  return student.previousSchool?.[key] ?? student[key] ?? "";
}

export function emergencyValue(
  student: StudentData,
  key: "phone" | "relation" | "name"
): string {
  if (typeof student.emergencyContact === "string")
    return key === "phone" ? student.emergencyContact : "";
  return student.emergencyContact?.[key] ?? "";
}

export function documentNames(student: StudentData): string {
  return (student.documentURLs ?? [])
    .map((doc) => String(doc.name ?? "").toLowerCase())
    .join(" ");
}

export function hasDocument(student: StudentData, needles: string[]): boolean {
  const haystack = documentNames(student);
  return needles.some((needle) => haystack.includes(needle));
}

export function otherDocumentNames(student: StudentData): string {
  const known = [
    "birth",
    "aadhaar",
    "parent aadhaar",
    "father aadhaar",
    "mother aadhaar",
    "tc",
    "bonafide",
    "report",
    "photo",
    "caste",
    "income",
  ];
  return (student.documentURLs ?? [])
    .map((doc) => String(doc.name ?? "").trim())
    .filter((name) => name.length > 0)
    .filter((name) => {
      const lower = name.toLowerCase();
      return !known.some((needle) => lower.includes(needle));
    })
    .join(", ");
}