import assert from "node:assert/strict";
import { calculateMonthlySalary, type SalaryCalculationInput } from "../services/salaryService";
import type { AttendanceRecord, Holiday, LeaveRequest, SchoolSettings, Teacher } from "../types/models";
import { daysInMonth } from "../utils/date";

const TEST_MONTH = "2026-07";

const createTeacher = (overrides?: Partial<Teacher>): Teacher => ({
  id: "T001",
  fullName: "Test Teacher",
  email: "teacher@school.com",
  internalEmail: "teacher@school.com",
  phone: "9876543210",
  subject: "Mathematics",
  employeeId: "E001",
  baseSalary: 32500,
  joiningDate: "2024-01-01",
  status: "active",
  allowedCLPerMonth: 3,
  lateDeductionRule: "after_3_lates_one_day",
  casualLeaveBalance: 3,
  casualLeaveUsedThisMonth: 0,
  lateEntriesThisMonth: 0,
  absentDaysThisMonth: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createSettings = (): SchoolSettings => ({
  schoolName: "Test School",
  campusLatitude: 18.3062,
  campusLongitude: 79.8829,
  geofenceRadiusMeters: 150,
  schoolStartTime: "09:00",
  graceMinutes: 10,
  salaryRules: {
    lateDeductionMode: "none",
    fixedLateDeductionAmount: 0,
    afterLateCountDeductDays: 3,
    manualDeductionDefault: 0,
    bonusDefault: 0,
  },
  timezone: "Asia/Kolkata",
});

function isSunday(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

function monthDate(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

function workingDates(month = TEST_MONTH, holidays: Holiday[] = []) {
  const [year, monthNumber] = month.split("-").map(Number);
  const holidayDates = new Set(holidays.map((holiday) => holiday.date.slice(0, 10)));
  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth(year, monthNumber); day += 1) {
    const date = monthDate(month, day);
    if (!isSunday(date) && !holidayDates.has(date)) dates.push(date);
  }
  return dates;
}

function attendance(date: string, overrides?: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    teacherId: "T001",
    date,
    month: date.slice(0, 7),
    year: Number(date.slice(0, 4)),
    status: "present",
    checkInTime: `${date}T09:00:00+05:30`,
    source: "mobile",
    sourcesUsed: ["mobile"],
    lateMinutes: 0,
    isLate: false,
    adminEdited: false,
    createdAt: `${date}T09:00:00+05:30`,
    updatedAt: `${date}T09:00:00+05:30`,
    ...overrides,
  };
}

function lateAttendance(date: string): AttendanceRecord {
  return attendance(date, {
    status: "late",
    checkInTime: `${date}T09:35:00+05:30`,
    lateMinutes: 25,
    isLate: true,
  });
}

function leave(startDate: string, endDate = startDate, overrides?: Partial<LeaveRequest>): LeaveRequest {
  return {
    id: `leave_${startDate}`,
    teacherId: "T001",
    teacherName: "Test Teacher",
    employeeId: "E001",
    startDate,
    endDate,
    reason: "Approved leave",
    status: "approved",
    requestedAt: `${startDate}T00:00:00+05:30`,
    ...overrides,
  };
}

function holiday(date: string): Holiday {
  return {
    id: `holiday_${date}`,
    date,
    title: "Test Holiday",
    type: "school",
    createdAt: `${date}T00:00:00+05:30`,
  };
}

function calculate(overrides: Partial<SalaryCalculationInput>) {
  return calculateMonthlySalary({
    teacher: createTeacher(),
    records: [],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
    payrollFinalized: true,
    ...overrides,
  });
}

function assertMoney(actual: number, expected: number, message: string) {
  assert.ok(Math.abs(actual - expected) < 0.01, `${message}: expected ${expected}, got ${actual}`);
}

function runTest(name: string, test: () => void) {
  test();
  console.log(`PASS ${name}`);
}

runTest("missing attendance becomes absent", () => {
  const report = calculate({ payrollFinalized: false, calculationDate: "2026-07-02T12:00:00+05:30" });
  const expectedDailyRate = 32500 / workingDates().length;
  assert.equal(report.workingDaysElapsed, 2);
  assert.equal(report.presentDays, 0);
  assert.equal(report.absentDays, 2);
  assertMoney(report.salaryDeduction, 2 * expectedDailyRate, "deduction");
  assert.ok(report.netPayable < report.baseSalary);
});

runTest("present zero does not get full salary in finalized month", () => {
  const report = calculate({});
  assert.equal(report.presentDays, 0);
  assert.equal(report.absentDays, workingDates().length);
  assertMoney(report.salaryDeduction, report.baseSalary, "deduction");
  assert.equal(report.netPayable, 0);
});

runTest("approved leave is paid only within CL balance", () => {
  const dates = workingDates();
  const report = calculate({
    leaveRequests: [leave(dates[0], dates[3])],
  });
  assert.equal(report.approvedLeaveCLDays, 4);
  assert.equal(report.paidLeaveDays, 3);
  assert.equal(report.excessCLDays, 1);
  assertMoney(report.excessLeaveDeduction, report.perDaySalary, "excess leave deduction");
});

runTest("approved leave with attendance counts as present", () => {
  const date = workingDates()[0];
  const report = calculate({
    records: [attendance(date)],
    leaveRequests: [leave(date)],
  });
  assert.equal(report.presentDays, 1);
  assert.equal(report.attendedApprovedLeaveDays, 1);
  assert.equal(report.approvedLeaveCLDays, 0);
  assert.equal(report.paidLeaveDays, 0);
});

runTest("current month does not count future dates as absent", () => {
  const report = calculate({
    payrollFinalized: false,
    calculationDate: "2026-07-01T12:00:00+05:30",
  });
  assert.equal(report.workingDaysElapsed, 1);
  assert.equal(report.absentDays, 1);
  assert.ok(report.absentDays < workingDates().length);
});

runTest("finalized full month calculates entire month", () => {
  const report = calculate({
    payrollFinalized: true,
    calculationDate: "2026-07-01T12:00:00+05:30",
  });
  assert.equal(report.workingDaysElapsed, workingDates().length);
  assert.equal(report.absentDays, workingDates().length);
  assert.equal(report.netPayable, 0);
});

runTest("net payable reduces when absent days exist", () => {
  const dates = workingDates();
  const records = dates.slice(0, dates.length - 4).map((date) => attendance(date));
  const report = calculate({ records });
  assert.equal(report.absentDays, 4);
  assert.ok(report.netPayable < report.baseSalary);
});

runTest("late-derived CL reduces CL balance and can create excess", () => {
  const dates = workingDates();
  const report = calculate({
    records: dates.slice(0, 6).map((date) => lateAttendance(date)),
    leaveRequests: [leave(dates[6], dates[7])],
  });
  assert.equal(report.lateEntries, 6);
  assert.equal(report.lateDerivedCLDays, 2);
  assert.equal(report.approvedLeaveCLDays, 2);
  assert.equal(report.paidLeaveDays, 1);
  assert.equal(report.excessCLDays, 1);
});

runTest("deduction is never negative and net never exceeds base", () => {
  const date = workingDates()[0];
  const report = calculate({
    records: workingDates().map((workingDate) => attendance(workingDate)),
    manualDeduction: -500,
    bonus: 10000,
    leaveRequests: [leave(date, date, { status: "rejected" })],
  });
  assert.ok(report.salaryDeduction >= 0);
  assert.ok(report.totalDeduction >= 0);
  assert.equal(report.netPayable, report.baseSalary);
});

runTest("holidays and Sundays are not counted as absences", () => {
  const dates = workingDates();
  const schoolHoliday = holiday(dates[0]);
  const report = calculate({
    holidays: [schoolHoliday],
  });
  assert.equal(report.totalWorkingDaysInMonth, workingDates(TEST_MONTH, [schoolHoliday]).length);
  assert.equal(report.absentDays, workingDates(TEST_MONTH, [schoolHoliday]).length);
  assert.equal(report.absentDates?.includes(schoolHoliday.date), false);
});

console.log("All salary calculation tests passed.");
