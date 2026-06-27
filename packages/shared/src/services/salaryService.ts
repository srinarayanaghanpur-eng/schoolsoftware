import type { AttendanceRecord, Holiday, LeaveRequest, SalaryReport, SchoolSettings, Teacher } from "../types/models";
import { DEFAULT_SETTINGS } from "../constants";
import { daysInMonth, nowIso } from "../utils/date";

export type SalaryCalculationInput = {
  teacher: Teacher;
  records: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
  holidays: Holiday[];
  month: string;
  settings?: SchoolSettings;
  manualDeduction?: number;
  bonus?: number;
  paid?: boolean;
  paidAt?: string;
  paymentNotes?: string;
};

function normalizeDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function isInMonth(dateStr: string, month: string): boolean {
  return dateStr.slice(0, 7) === month;
}

function expandLeaveDates(startDate: string, endDate: string, month: string): string[] {
  const dates: string[] = [];
  const [sy, sm, sd] = normalizeDate(startDate).split("-").map(Number);
  const [ey, em, ed] = normalizeDate(endDate).split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    if (isInMonth(dateStr, month)) {
      dates.push(dateStr);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function buildLeaveDayInfo(
  leaveRequests: LeaveRequest[],
  records: AttendanceRecord[],
  month: string
): {
  approvedLeaveCLDates: string[];
  attendedApprovedLeaveDates: string[];
  approvedLeaveInfo: string;
} {
  const approved = leaveRequests.filter((l) => l.status === "approved");

  const checkInByDate = new Set<string>();
  for (const record of records) {
    if (record.checkInTime) {
      checkInByDate.add(normalizeDate(record.date));
    }
  }

  const leaveDates: string[] = [];
  for (const leave of approved) {
    const expanded = expandLeaveDates(leave.startDate, leave.endDate, month);
    leaveDates.push(...expanded);
  }

  const uniqueLeaveDates = [...new Set(leaveDates)];

  const approvedLeaveCLDates: string[] = [];
  const attendedApprovedLeaveDates: string[] = [];

  for (const date of uniqueLeaveDates) {
    if (checkInByDate.has(date)) {
      attendedApprovedLeaveDates.push(date);
    } else {
      approvedLeaveCLDates.push(date);
    }
  }

  const totalDays = approvedLeaveCLDates.length + attendedApprovedLeaveDates.length;
  const parts: string[] = [`Approved: ${totalDays} day${totalDays !== 1 ? "s" : ""}`];
  if (approvedLeaveCLDates.length > 0) {
    parts.push(`CL used: ${approvedLeaveCLDates.length} day${approvedLeaveCLDates.length !== 1 ? "s" : ""} | Dates: ${approvedLeaveCLDates.join(", ")}`);
  }
  if (attendedApprovedLeaveDates.length > 0) {
    parts.push(`Attended: ${attendedApprovedLeaveDates.length} day${attendedApprovedLeaveDates.length !== 1 ? "s" : ""} | Dates: ${attendedApprovedLeaveDates.join(", ")}`);
  }
  const approvedLeaveInfo = parts.join(" | ");

  return { approvedLeaveCLDates, attendedApprovedLeaveDates, approvedLeaveInfo };
}

export function calculateMonthlySalary(input: SalaryCalculationInput): SalaryReport {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const [yearText, monthText] = input.month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  const totalCalendarDays = daysInMonth(year, monthNumber);
  const holidays = input.holidays.length;
  const workingDays = Math.max(1, totalCalendarDays - holidays);

  const presentDays = input.records.filter((item) => item.status === "present").length;
  const lateEntries = input.records.filter((item) => item.status === "late").length;

  const perDaySalary = input.teacher.baseSalary / workingDays;

  const approvedLeaveInfo = buildLeaveDayInfo(
    input.leaveRequests ?? [],
    input.records,
    input.month
  );
  const approvedLeaveCLDates = approvedLeaveInfo.approvedLeaveCLDates;
  const attendedApprovedLeaveDates = approvedLeaveInfo.attendedApprovedLeaveDates;

  const allApprovedLeaveDates = new Set([
    ...approvedLeaveCLDates,
    ...attendedApprovedLeaveDates,
  ]);

  const plainAbsentDays = input.records.filter((record) => {
    if (record.status !== "absent" && record.status !== "not_marked") return false;
    if (record.checkInTime) return false;
    return !allApprovedLeaveDates.has(normalizeDate(record.date));
  }).length;

  const approvedLeaveCLDays = approvedLeaveCLDates.length;
  const attendedApprovedLeaveDays = attendedApprovedLeaveDates.length;
  const lateDerivedCLDays = Math.floor(lateEntries / 3);
  const totalCLUsed = approvedLeaveCLDays + lateDerivedCLDays;
  const clAllowanceThisMonth = input.teacher.allowedCLPerMonth ?? 3;
  const paidCLDays = Math.min(totalCLUsed, clAllowanceThisMonth);
  const excessCLDays = Math.max(totalCLUsed - clAllowanceThisMonth, 0);
  const unpaidDeductionDays = plainAbsentDays + excessCLDays;
  const salaryDeduction = unpaidDeductionDays * perDaySalary;

  const remainingCl = Math.max(0, clAllowanceThisMonth - totalCLUsed);

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

    totalCalendarDays,
    workingDays,
    presentDays,
    lateDays: lateEntries,
    lateEntries,
    clDays: paidCLDays,
    absentDays: plainAbsentDays,
    holidays,

    baseSalary: Math.round(input.teacher.baseSalary),
    perDaySalary: Math.round(perDaySalary * 100) / 100,

    clAllowanceThisMonth,
    clUsedFromAbsent: approvedLeaveCLDays,
    clUsedFromLate: lateDerivedCLDays,
    totalClUsed: totalCLUsed,
    remainingCl,
    excessLeave: excessCLDays,

    approvedLeaveCLDays,
    attendedApprovedLeaveDays,
    lateDerivedCLDays,
    paidCLDays,
    excessCLDays,
    plainAbsentDays,
    unpaidDeductionDays,
    approvedLeaveRequests: (input.leaveRequests ?? []).filter((l) => l.status === "approved"),
    approvedLeaveInfo: approvedLeaveInfo.approvedLeaveInfo,
    salaryDeduction: Math.round(salaryDeduction * 100) / 100,

    absentDeduction: 0,
    lateDeduction: 0,
    excessLeaveDeduction: Math.round(salaryDeduction * 100) / 100,
    manualDeduction: Math.round(manualDeduction),
    bonus: Math.round(bonus),
    totalDeduction: Math.round(totalDeduction * 100) / 100,

    netPayable: Math.max(0, Math.round(netPayable * 100) / 100),

    paid: input.paid ?? false,
    paidAt: input.paidAt,
    paymentNotes: input.paymentNotes,
    generatedAt: timestamp,
    updatedAt: timestamp,
  };
}
