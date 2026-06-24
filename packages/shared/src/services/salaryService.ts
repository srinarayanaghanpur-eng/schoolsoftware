import type { AttendanceRecord, Holiday, SalaryReport, SchoolSettings, Teacher } from "../types/models";
import { DEFAULT_SETTINGS } from "../constants";
import { daysInMonth, nowIso } from "../utils/date";

export type SalaryCalculationInput = {
  teacher: Teacher;
  records: AttendanceRecord[];
  holidays: Holiday[];
  month: string;
  settings?: SchoolSettings;
  manualDeduction?: number;
  bonus?: number;
  paid?: boolean;
  paidAt?: string;
  paymentNotes?: string;
};

/**
 * Calculate monthly salary with correct formulas:
 * CL Used = absents + floor(lateEntries / 3)
 * Remaining CL = max(0, 3 - totalClUsed)
 * Excess Leave = max(0, totalClUsed - 3)
 * Salary Deduction = excessLeave × dailySalary
 * Net Salary = baseSalary - totalDeduction + bonus
 */
export function calculateMonthlySalary(input: SalaryCalculationInput): SalaryReport {
  const settings = input.settings ?? DEFAULT_SETTINGS;
  const [yearText, monthText] = input.month.split("-");
  const year = Number(yearText);
  const monthNumber = Number(monthText);
  
  // Calculate working days
  const totalCalendarDays = daysInMonth(year, monthNumber);
  const holidays = input.holidays.length;
  const workingDays = Math.max(1, totalCalendarDays - holidays);
  
  // Count attendance
  const presentDays = input.records.filter((item) => item.status === "present").length;
  const lateEntries = input.records.filter((item) => item.status === "late").length; // Count of late entries
  const lateDays = lateEntries; // Same as lateEntries for our purposes
  const clDays = input.records.filter((item) => item.status === "cl").length;
  const absentDays = input.records.filter((item) => item.status === "absent" || item.status === "not_marked").length;
  
  // Per-day salary
  const perDaySalary = input.teacher.baseSalary / workingDays;
  
  // ========== CRITICAL FORMULAS ==========
  
  // CL Usage Calculation
  const clAllowanceThisMonth = input.teacher.allowedCLPerMonth ?? 3; // Default 3 per month
  const clUsedFromAbsent = absentDays; // 1 absent = 1 CL
  const clUsedFromLate = Math.floor(lateEntries / 3); // Every 3 lates = 1 CL
  const totalClUsed = clUsedFromAbsent + clUsedFromLate;
  const remainingCl = Math.max(0, clAllowanceThisMonth - totalClUsed);
  const excessLeave = Math.max(0, totalClUsed - clAllowanceThisMonth);
  
  // Deduction Calculation (only excess leave deductions)
  const absentDeduction = 0; // Absents are covered by CL, not salary deduction
  const lateDeduction = 0; // Lates are covered by CL, not salary deduction
  const excessLeaveDeduction = excessLeave * perDaySalary; // Only excess CL causes deduction
  const manualDeduction = input.manualDeduction ?? settings.salaryRules.manualDeductionDefault;
  const bonus = input.bonus ?? settings.salaryRules.bonusDefault;
  
  const totalDeduction = excessLeaveDeduction + manualDeduction;
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
    lateDays,
    lateEntries,
    clDays,
    absentDays,
    holidays,
    
    // Salary Calculation
    baseSalary: Math.round(input.teacher.baseSalary),
    perDaySalary: Math.round(perDaySalary * 100) / 100,
    
    // CL Tracking
    clAllowanceThisMonth,
    clUsedFromAbsent,
    clUsedFromLate,
    totalClUsed,
    remainingCl,
    excessLeave,
    
    // Deductions (detailed breakdown)
    absentDeduction: 0,
    lateDeduction: 0,
    excessLeaveDeduction: Math.round(excessLeaveDeduction * 100) / 100,
    manualDeduction: Math.round(manualDeduction),
    bonus: Math.round(bonus),
    totalDeduction: Math.round(totalDeduction * 100) / 100,
    
    // Final Salary
    netPayable: Math.max(0, Math.round(netPayable * 100) / 100),
    
    // Payment Status
    paid: input.paid ?? false,
    paidAt: input.paidAt,
    paymentNotes: input.paymentNotes,
    generatedAt: timestamp,
    updatedAt: timestamp
  };
}
