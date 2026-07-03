import type { AttendanceRecord, Holiday, LeaveRequest, SalaryReport, SchoolSettings, Teacher } from "../types/models";
import { DEFAULT_SETTINGS } from "../constants";
import { daysInMonth, nowIso, toDateKey } from "../utils/date";

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
  payrollFinalized?: boolean;
  calculationDate?: Date | string;
};

export const MONTHLY_CL_ALLOWANCE = 3;

function normalizeDate(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function isInMonth(dateStr: string, month: string): boolean {
  return normalizeDate(dateStr).slice(0, 7) === month;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sortDates(dates: Iterable<string>): string[] {
  return [...new Set(dates)].sort();
}

function isSunday(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function monthDate(year: number, monthNumber: number, day: number): string {
  return `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthEndDate(year: number, monthNumber: number): string {
  return monthDate(year, monthNumber, daysInMonth(year, monthNumber));
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
    if (isInMonth(dateStr, month)) dates.push(dateStr);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function buildWorkingDates(year: number, monthNumber: number, holidays: Holiday[]) {
  const month = `${year}-${String(monthNumber).padStart(2, "0")}`;
  const holidayDates = new Set(
    holidays
      .map((holiday) => normalizeDate(holiday.date))
      .filter((date) => isInMonth(date, month) && !isSunday(date))
  );

  const dates: string[] = [];
  const totalCalendarDays = daysInMonth(year, monthNumber);
  for (let day = 1; day <= totalCalendarDays; day += 1) {
    const date = monthDate(year, monthNumber, day);
    if (!isSunday(date) && !holidayDates.has(date)) dates.push(date);
  }

  return { dates, holidayDates };
}

function elapsedCutoffDate(input: SalaryCalculationInput, settings: SchoolSettings, year: number, monthNumber: number) {
  const monthStart = monthDate(year, monthNumber, 1);
  const monthEnd = monthEndDate(year, monthNumber);
  if (input.payrollFinalized) return monthEnd;

  const today = toDateKey(input.calculationDate ?? new Date(), settings.timezone);
  const todayMonth = today.slice(0, 7);
  if (todayMonth < input.month) return "";
  if (todayMonth > input.month) return monthEnd;
  if (today < monthStart) return "";
  return today > monthEnd ? monthEnd : today;
}

function hasValidCheckIn(record: AttendanceRecord): boolean {
  return Boolean(record.checkInTime);
}

function isLateRecord(record: AttendanceRecord): boolean {
  return record.status === "late" || Boolean(record.isLate) || Number(record.lateMinutes ?? 0) > 0;
}

function buildApprovedLeaveInfo(approvedLeaveCLDates: string[], attendedApprovedLeaveDates: string[]) {
  const totalDays = approvedLeaveCLDates.length + attendedApprovedLeaveDates.length;
  const parts: string[] = [`Approved: ${totalDays} day${totalDays !== 1 ? "s" : ""}`];
  if (approvedLeaveCLDates.length > 0) {
    parts.push(`CL requested: ${approvedLeaveCLDates.length} day${approvedLeaveCLDates.length !== 1 ? "s" : ""} | Dates: ${approvedLeaveCLDates.join(", ")}`);
  }
  if (attendedApprovedLeaveDates.length > 0) {
    parts.push(`Attended: ${attendedApprovedLeaveDates.length} day${attendedApprovedLeaveDates.length !== 1 ? "s" : ""} | Dates: ${attendedApprovedLeaveDates.join(", ")}`);
  }
  return parts.join(" | ");
}

export function calculateMonthlySalary(input: SalaryCalculationInput): SalaryReport {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const [yearText, monthText] = input.month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);

  const totalCalendarDays = daysInMonth(year, monthNumber);
  const { dates: totalWorkingDates, holidayDates } = buildWorkingDates(year, monthNumber, input.holidays);
  const cutoffDate = elapsedCutoffDate(input, settings, year, monthNumber);
  const workingDatesElapsed = cutoffDate
    ? totalWorkingDates.filter((date) => date <= cutoffDate)
    : [];
  const workingDateSet = new Set(workingDatesElapsed);

  const attendanceRecords = input.records.filter((record) => record.teacherId === input.teacher.id && isInMonth(record.date, input.month));
  const checkInRecords = attendanceRecords.filter((record) => workingDateSet.has(normalizeDate(record.date)) && hasValidCheckIn(record));
  const presentDates = sortDates(checkInRecords.map((record) => normalizeDate(record.date)));
  const presentDateSet = new Set(presentDates);
  const lateDates = sortDates(checkInRecords.filter(isLateRecord).map((record) => normalizeDate(record.date)));

  const approvedLeaveDates = sortDates(
    (input.leaveRequests ?? [])
      .filter((leave) => leave.teacherId === input.teacher.id && leave.status === "approved")
      .flatMap((leave) => expandLeaveDates(leave.startDate, leave.endDate, input.month))
      .filter((date) => workingDateSet.has(date))
  );

  const approvedLeaveCLDates = approvedLeaveDates.filter((date) => !presentDateSet.has(date));
  const attendedApprovedLeaveDates = approvedLeaveDates.filter((date) => presentDateSet.has(date));

  const lateEntries = lateDates.length;
  const lateDerivedCLDays = 0;
  const approvedLeaveCLDays = approvedLeaveCLDates.length;
  const clAllowanceThisMonth = MONTHLY_CL_ALLOWANCE;
  const availableCLBalance = clAllowanceThisMonth;
  const approvedPaidCLDays = Math.min(approvedLeaveCLDays, availableCLBalance);
  const paidLeaveDates = new Set(approvedLeaveCLDates.slice(0, approvedPaidCLDays));
  const unpaidApprovedLeaveDates = approvedLeaveCLDates.filter((date) => !paidLeaveDates.has(date));
  const paidCLDays = approvedPaidCLDays;
  const paidLeaveDays = approvedPaidCLDays;
  const excessCLDays = unpaidApprovedLeaveDates.length;
  const totalCLUsed = approvedPaidCLDays;
  const remainingCl = Math.max(0, clAllowanceThisMonth - approvedPaidCLDays);

  const approvedLeaveCLDateSet = new Set(approvedLeaveCLDates);
  const plainAbsentDates = workingDatesElapsed.filter((date) => !presentDateSet.has(date) && !approvedLeaveCLDateSet.has(date));
  const absentDates = sortDates([...plainAbsentDates, ...unpaidApprovedLeaveDates]);
  const unpaidAbsentDays = plainAbsentDates.length + excessCLDays;
  const absentDays = unpaidAbsentDays;
  const earnedPaidDays = presentDates.length + approvedPaidCLDays;

  const dailyRate = totalWorkingDates.length > 0 ? input.teacher.baseSalary / totalWorkingDates.length : 0;
  const absentDeduction = plainAbsentDates.length * dailyRate;
  const excessLeaveDeduction = excessCLDays * dailyRate;
  const salaryDeduction = unpaidAbsentDays * dailyRate;
  const manualDeduction = Math.max(0, input.manualDeduction ?? settings.salaryRules.manualDeductionDefault);
  const bonus = Math.max(0, input.bonus ?? settings.salaryRules.bonusDefault);
  const totalDeduction = salaryDeduction + manualDeduction;
  const grossEarnedSalary = earnedPaidDays * dailyRate;
  const netPayable = Math.max(0, grossEarnedSalary + bonus - manualDeduction);

  const timestamp = nowIso();
  const roundedPerDaySalary = roundMoney(dailyRate);
  const roundedSalaryDeduction = roundMoney(salaryDeduction);
  const roundedGrossEarnedSalary = roundMoney(grossEarnedSalary);
  const roundedNetPayable = roundMoney(netPayable);

  return {
    teacherId: input.teacher.id,
    teacherName: input.teacher.fullName,
    subject: input.teacher.subject,
    employeeId: input.teacher.employeeId,
    month: input.month,
    year,

    totalCalendarDays,
    totalWorkingDaysInMonth: totalWorkingDates.length,
    workingDaysElapsed: workingDatesElapsed.length,
    payrollFinalized: Boolean(input.payrollFinalized),
    calculationAsOfDate: cutoffDate || undefined,
    workingDays: workingDatesElapsed.length,
    presentDays: presentDates.length,
    lateDays: lateEntries,
    lateEntries,
    clDays: paidLeaveDays,
    absentDays,
    holidays: holidayDates.size,

    baseSalary: Math.round(input.teacher.baseSalary),
    perDaySalary: roundedPerDaySalary,

    clAllowanceThisMonth,
    clUsedFromAbsent: approvedPaidCLDays,
    clUsedFromLate: lateDerivedCLDays,
    totalClUsed: totalCLUsed,
    remainingCl,
    excessLeave: excessCLDays,

    approvedLeaveCLDays,
    attendedApprovedLeaveDays: attendedApprovedLeaveDates.length,
    lateDerivedCLDays,
    paidCLDays,
    approvedPaidCLDays,
    paidLeaveDays,
    excessCLDays,
    plainAbsentDays: plainAbsentDates.length,
    unpaidAbsentDays,
    unpaidDeductionDays: unpaidAbsentDays,
    earnedPaidDays,
    grossEarnedSalary: roundedGrossEarnedSalary,
    approvedLeaveRequests: (input.leaveRequests ?? []).filter((leave) => leave.teacherId === input.teacher.id && leave.status === "approved"),
    approvedLeaveInfo: buildApprovedLeaveInfo(approvedLeaveCLDates, attendedApprovedLeaveDates),
    salaryDeduction: roundedSalaryDeduction,

    absentDeduction: roundMoney(absentDeduction),
    lateDeduction: 0,
    excessLeaveDeduction: roundMoney(excessLeaveDeduction),
    manualDeduction: Math.round(manualDeduction),
    bonus: Math.round(bonus),
    totalDeduction: roundMoney(totalDeduction),

    netPayable: roundedNetPayable,

    paid: input.paid ?? false,
    paidAt: input.paidAt,
    paymentNotes: input.paymentNotes,
    presentDates,
    absentDates,
    approvedLeaveDates,
    lateDates,
    calculationDebug: {
      staffId: input.teacher.id,
      staffName: input.teacher.fullName,
      month: input.month,
      totalWorkingDaysInMonth: totalWorkingDates.length,
      workingDaysElapsed: workingDatesElapsed.length,
      presentDates,
      absentDates,
      approvedLeaveDates,
      attendedApprovedLeaveDates,
      lateDates,
      paidLeaveDays,
      approvedPaidCLDays,
      unpaidAbsentDays,
      excessCLDays,
      earnedPaidDays,
      grossEarnedSalary: roundedGrossEarnedSalary,
      dailyRate: roundedPerDaySalary,
      deduction: roundedSalaryDeduction,
      netPayable: roundedNetPayable
    },
    generatedAt: timestamp,
    updatedAt: timestamp,
  };
}
