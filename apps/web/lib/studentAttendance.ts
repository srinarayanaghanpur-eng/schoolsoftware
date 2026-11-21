export const STUDENT_ATTENDANCE_STATUSES = [
  "present",
  "absent",
  "late",
  "half_day",
  "leave",
  "holiday"
] as const;

export type StudentAttendanceStatus = (typeof STUDENT_ATTENDANCE_STATUSES)[number];

export const STUDENT_ATTENDANCE_LABELS: Record<StudentAttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
  leave: "Leave",
  holiday: "Holiday"
};

export function isStudentAttendanceStatus(value: unknown): value is StudentAttendanceStatus {
  return typeof value === "string" && (STUDENT_ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/**
 * Deterministic id keeps one document per student per day, so re-saving the
 * roster is idempotent (1 write per record, never a duplicate).
 */
export function studentAttendanceDocId(date: string, studentId: string) {
  return `${date}_${studentId.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

export type StudentAttendanceSummary = {
  present: number;
  absent: number;
  late: number;
  half_day: number;
  leave: number;
  holiday: number;
  unmarked: number;
  total: number;
  marked: number;
};

export function summarizeStudentAttendance(statuses: string[]): StudentAttendanceSummary {
  const counts: StudentAttendanceSummary = {
    present: 0,
    absent: 0,
    late: 0,
    half_day: 0,
    leave: 0,
    holiday: 0,
    unmarked: 0,
    total: statuses.length,
    marked: 0
  };
  for (const status of statuses) {
    if (isStudentAttendanceStatus(status)) counts[status] += 1;
    else counts.unmarked += 1;
  }
  counts.marked = counts.total - counts.unmarked;
  return counts;
}
