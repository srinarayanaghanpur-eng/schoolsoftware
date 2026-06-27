import type {
  AttendanceRecord,
  Holiday,
  LeaveRequest,
  SalaryReport,
  SchoolSettings,
  Teacher
} from "../types/models";
import { DEFAULT_SETTINGS } from "../constants";
import { daysInMonth, nowIso } from "../utils/date";

/**
 * ============================================================================
 * STAGE 4 — Monthly salary with leave requests & per-day absence deduction
 * ============================================================================
 *
 * Rules (confirmed with admin):
 *  - Per-day salary   = baseSalary / workingDays   (workingDays = calendarDays - holidays)
 *  - CL allowance     = teacher.allowedCLPerMonth (default 3) per month.
 *  - 3 lates          = 1 CL used                  (lateDerivedCLDays = floor(lates / 3))
 *  - Approved leave with NO check-in = 1 CL used (paid, consumes the bucket).
 *  - Approved leave where the teacher DID check in = present (no CL used).
 *  - Plain absent (no check-in AND no approved leave) = that day's per-day pay is CUT.
 *  - CL used beyond the monthly allowance (from leave + lates) is also CUT per day.
 *
 *  netPayable = baseSalary - (plainAbsentDays + excessCLDays) * perDay - manualDeduction + bonus
 *
 * This function is pure and returns the extended SalaryReport shape.
 */
export type Stage4SalaryInput = {
  teacher: Teacher;
  records: AttendanceRecord[];
  holidays: Holiday[];
  /** All leave requests for this teacher; only `approved` ones overlapping the month are used. */
  leaveRequests?: LeaveRequest[];
  month: string; // "YYYY-MM"
  settings?: SchoolSettings;
  manualDeduction?: number;
  bonus?: number;
  paid?: boolean;
  paidAt?: string;
  paymentNotes?: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Expand a leave request into the individual "YYYY-MM-DD" dates that fall inside `month`. */
function leaveDatesInMonth(request: LeaveRequest, month: string): string[] {
  const start = request.startDate?.slice(0, 10);
  const end = (request.endDate || request.startDate)?.slice(0, 10);
  if (!start) return [];

  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  // Guard against malformed / reversed ranges.
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime()) || cursor > last) {
    return start.startsWith(month) ? [start] : [];
  }

  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    if (key.startsWith(month)) dates.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function formatLeaveInfo(requests: LeaveRequest[]): string {
  if (!requests.length) return "";
  return requests
    .map((request) => {
      const start = request.startDate?.slice(0, 10) ?? "";
      const end = request.endDate?.slice(0, 10) ?? start;
      const range = start === end ? start : `${start} to ${end}`;
      const reason = request.reason?.trim();
      return reason ? `${range} (${reason})` : range;
    })
    .join("; ");
}

export function calculateMonthlySalaryStage4(input: Stage4SalaryInput): SalaryReport {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const [yearText, monthText] = input.month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  // ---- Working days ----
  const totalCalendarDays = daysInMonth(year, monthNumber);
  const holidaySet = new Set(input.holidays.map((holiday) => holiday.date?.slice(0, 10)).filter(Boolean));
  const holidayCount = holidaySet.size;
  const workingDays = Math.max(1, totalCalendarDays - holidayCount);
  const perDaySalary = input.teacher.baseSalary / workingDays;

  // ---- Index attendance by date ----
  const monthRecords = input.records.filter((record) => record.month === input.month || record.date?.startsWith(input.month));
  const statusByDate = new Map<string, AttendanceRecord["status"]>();
  for (const record of monthRecords) {
    if (record.date) statusByDate.set(record.date.slice(0, 10), record.status);
  }
  const attended = (date: string) => {
    const status = statusByDate.get(date);
    return status === "present" || status === "late";
  };

  const presentDays = monthRecords.filter((record) => record.status === "present").length;
  const lateEntries = monthRecords.filter((record) => record.status === "late").length;

  // ---- Approved leave dates this month (excluding holidays) ----
  const approvedLeaveRequests = (input.leaveRequests ?? []).filter(
    (request) => request.status === "approved" && request.teacherId === input.teacher.id
  );
  const approvedLeaveDates = new Set<string>();
  for (const request of approvedLeaveRequests) {
    for (const date of leaveDatesInMonth(request, input.month)) {
      if (!holidaySet.has(date)) approvedLeaveDates.add(date);
    }
  }
  // Any day explicitly marked "cl" in attendance also counts as approved leave.
  for (const record of monthRecords) {
    if (record.status === "cl" && record.date) {
      const date = record.date.slice(0, 10);
      if (!holidaySet.has(date)) approvedLeaveDates.add(date);
    }
  }

  // ---- Classify leave days: attended (present) vs CL-consumed ----
  let approvedLeaveCLDays = 0;
  let attendedApprovedLeaveDays = 0;
  for (const date of approvedLeaveDates) {
    if (attended(date)) attendedApprovedLeaveDays += 1;
    else approvedLeaveCLDays += 1;
  }

  // ---- Plain absences: no check-in, no approved leave, not a holiday ----
  const plainAbsentDays = monthRecords.filter((record) => {
    if (record.status !== "absent" && record.status !== "not_marked") return false;
    const date = record.date?.slice(0, 10) ?? "";
    return !approvedLeaveDates.has(date) && !holidaySet.has(date);
  }).length;

  // ---- CL bucket ----
  const clAllowanceThisMonth = input.teacher.allowedCLPerMonth ?? 3;
  const lateDerivedCLDays = Math.floor(lateEntries / 3);
  const totalClUsed = approvedLeaveCLDays + lateDerivedCLDays;
  const remainingCl = Math.max(0, clAllowanceThisMonth - totalClUsed);
  const excessCLDays = Math.max(0, totalClUsed - clAllowanceThisMonth);
  const paidCLDays = Math.min(totalClUsed, clAllowanceThisMonth);

  // ---- Deductions ----
  const unpaidDeductionDays = plainAbsentDays + excessCLDays;
  const salaryDeduction = unpaidDeductionDays * perDaySalary;
  const absentDeduction = plainAbsentDays * perDaySalary;
  const manualDeduction = input.manualDeduction ?? settings.salaryRules.manualDeductionDefault;
  const bonus = input.bonus ?? settings.salaryRules.bonusDefault;
  const totalDeduction = salaryDeduction + manualDeduction;
  const netPayable = Math.max(0, input.teacher.baseSalary - totalDeduction + bonus);

  const timestamp = nowIso();

  return {
    teacherId: input.teacher.id,
    teacherName: input.teacher.fullName,
    subject: input.teacher.subject,
    employeeId: input.teacher.employeeId,
    month: input.month,
    year,

    // Attendance Data
    totalCalendarDays,
    workingDays,
    presentDays,
    lateDays: lateEntries,
    lateEntries,
    clDays: approvedLeaveCLDays,
    absentDays: plainAbsentDays,
    holidays: holidayCount,

    // Salary Calculation
    baseSalary: Math.round(input.teacher.baseSalary),
    perDaySalary: round2(perDaySalary),

    // CL Tracking
    clAllowanceThisMonth,
    clUsedFromAbsent: approvedLeaveCLDays,
    clUsedFromLate: lateDerivedCLDays,
    totalClUsed,
    remainingCl,
    excessLeave: excessCLDays,

    // New CL/leave breakdown
    approvedLeaveCLDays,
    attendedApprovedLeaveDays,
    lateDerivedCLDays,
    paidCLDays,
    excessCLDays,
    plainAbsentDays,
    unpaidDeductionDays,
    approvedLeaveRequests,
    approvedLeaveInfo: formatLeaveInfo(approvedLeaveRequests),
    salaryDeduction: round2(salaryDeduction),

    // Deductions (detailed breakdown)
    absentDeduction: round2(absentDeduction),
    lateDeduction: 0,
    excessLeaveDeduction: round2(salaryDeduction), // alias for salaryDeduction (backward compat)
    manualDeduction: Math.round(manualDeduction),
    bonus: Math.round(bonus),
    totalDeduction: round2(totalDeduction),

    // Final Salary
    netPayable: Math.max(0, round2(netPayable)),

    // Payment Status
    paid: input.paid ?? false,
    paidAt: input.paidAt,
    paymentNotes: input.paymentNotes,
    generatedAt: timestamp,
    updatedAt: timestamp
  };
}
