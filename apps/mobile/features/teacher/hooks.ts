/**
 * Teacher workspace helpers — presentation-side derivations over the
 * attendance data hook. No Firestore access here.
 */
import { useMemo } from "react";
import type { AttendanceRecord } from "@sri-narayana/shared";
import { getAttendancePercentage } from "@sri-narayana/shared";

export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function dateLabel(now = new Date()) {
  return now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function localDateKey(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function formatTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export type AttendanceTone = "success" | "warning" | "error" | "neutral";

export function statusTone(status?: string): { label: string; tone: AttendanceTone } {
  switch (status) {
    case "present":
      return { label: "Present", tone: "success" };
    case "late":
      return { label: "Late", tone: "warning" };
    case "absent":
      return { label: "Absent", tone: "error" };
    case "leave":
      return { label: "Leave", tone: "neutral" };
    default:
      return { label: "Not marked", tone: "neutral" };
  }
}

/** Month-to-date rollup used by Home, History and Profile. */
export function useAttendanceSummary(records: AttendanceRecord[]) {
  return useMemo(() => {
    const today = records.find((record) => record.date === localDateKey());
    const present = records.filter((r) => r.status === "present" || r.status === "late").length;
    const late = records.filter((r) => r.status === "late").length;
    const absent = records.filter((r) => r.status === "absent").length;
    return {
      today,
      percentage: getAttendancePercentage(records),
      present,
      late,
      absent,
      checkedIn: Boolean(today?.checkInTime) && !today?.checkOutTime,
      checkedOut: Boolean(today?.checkOutTime)
    };
  }, [records]);
}
