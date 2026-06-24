import { calculateMonthlySalary } from "./salaryService";
import type { AttendanceRecord, Holiday, Teacher, SchoolSettings } from "../types/models";

const createTeacher = (overrides?: Partial<Teacher>): Teacher => ({
  id: "T001",
  fullName: "Test Teacher",
  email: "teacher@school.com",
  internalEmail: "teacher@school.com",
  phone: "9876543210",
  subject: "Mathematics",
  employeeId: "E001",
  baseSalary: 50000,
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

const createAttendanceRecord = (overrides?: Partial<AttendanceRecord>): AttendanceRecord => ({
  teacherId: "T001",
  date: "2026-06-01",
  month: "2026-06",
  year: 2026,
  status: "present",
  source: "mobile",
  sourcesUsed: ["mobile"],
  lateMinutes: 0,
  isLate: false,
  adminEdited: false,
  createdAt: "2026-06-01T08:00:00Z",
  updatedAt: "2026-06-01T08:00:00Z",
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

// Test Example 1
console.log("=" .repeat(80));
console.log("TEST: EXAMPLE 1 - 6 LATES + 1 ABSENT");
console.log("=" .repeat(80));

const records1: AttendanceRecord[] = [];
for (let i = 0; i < 20; i++) {
  records1.push(createAttendanceRecord({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    month: "2026-06",
    status: "present",
  }));
}

// Add 1 absent
records1.push(createAttendanceRecord({
  date: "2026-06-21",
  month: "2026-06",
  status: "absent",
}));

// Add 6 late entries
for (let i = 0; i < 6; i++) {
  records1.push(createAttendanceRecord({
    date: `2026-06-${String(22 + i).padStart(2, "0")}`,
    month: "2026-06",
    status: "late",
    isLate: true,
    lateMinutes: 15,
  }));
}

const report1 = calculateMonthlySalary({
  teacher: createTeacher(),
  records: records1,
  holidays: [],
  month: "2026-06",
  settings: createSettings(),
});

console.log(`
Input:
  Base Salary: ₹${report1.baseSalary}
  Working Days: ${report1.workingDays}
  Present Days: ${report1.presentDays}
  Absent Days: ${report1.absentDays}
  Late Entries: ${report1.lateEntries}

Calculations:
  CL from Absents: ${report1.clUsedFromAbsent}
  CL from Lates (floor(6/3)): ${report1.clUsedFromLate}
  Total CL Used: ${report1.totalClUsed}
  Remaining CL: ${report1.remainingCl}
  Excess Leave: ${report1.excessLeave}
  Daily Salary: ₹${report1.perDaySalary}

Salary:
  Deduction (Excess × Daily): ₹${report1.excessLeaveDeduction}
  Net Salary: ₹${report1.netPayable}

✅ Expected: Net = ₹50,000, Excess = 0
✅ Got: Net = ₹${report1.netPayable}, Excess = ${report1.excessLeave}
${report1.netPayable === 50000 && report1.excessLeave === 0 ? "✅ PASS" : "❌ FAIL"}
`);

// Test Example 2
console.log("=" .repeat(80));
console.log("TEST: EXAMPLE 2 - 9 LATES + 2 ABSENTS");
console.log("=" .repeat(80));

const records2: AttendanceRecord[] = [];
for (let i = 0; i < 19; i++) {
  records2.push(createAttendanceRecord({
    date: `2026-06-${String(i + 1).padStart(2, "0")}`,
    month: "2026-06",
    status: "present",
  }));
}

// Add 2 absents
records2.push(createAttendanceRecord({
  date: "2026-06-20",
  month: "2026-06",
  status: "absent",
}));
records2.push(createAttendanceRecord({
  date: "2026-06-21",
  month: "2026-06",
  status: "absent",
}));

// Add 9 late entries
for (let i = 0; i < 9; i++) {
  records2.push(createAttendanceRecord({
    date: `2026-06-${String(22 + i).padStart(2, "0")}`,
    month: "2026-06",
    status: "late",
    isLate: true,
    lateMinutes: 15,
  }));
}

const report2 = calculateMonthlySalary({
  teacher: createTeacher(),
  records: records2,
  holidays: [],
  month: "2026-06",
  settings: createSettings(),
});

console.log(`
Input:
  Base Salary: ₹${report2.baseSalary}
  Working Days: ${report2.workingDays}
  Present Days: ${report2.presentDays}
  Absent Days: ${report2.absentDays}
  Late Entries: ${report2.lateEntries}

Calculations:
  CL from Absents: ${report2.clUsedFromAbsent}
  CL from Lates (floor(9/3)): ${report2.clUsedFromLate}
  Total CL Used: ${report2.totalClUsed}
  Remaining CL: ${report2.remainingCl}
  Excess Leave: ${report2.excessLeave}
  Daily Salary: ₹${report2.perDaySalary}

Salary:
  Deduction (Excess × Daily): ₹${report2.excessLeaveDeduction}
  Net Salary: ₹${report2.netPayable}

✅ Expected: Net = ₹46,666.67, Excess = 2
✅ Got: Net = ₹${report2.netPayable}, Excess = ${report2.excessLeave}
${Math.abs(report2.netPayable - 46666.67) < 1 && report2.excessLeave === 2 ? "✅ PASS" : "❌ FAIL"}
`);

console.log("=" .repeat(80));
console.log("VERIFICATION SUMMARY");
console.log("=" .repeat(80));

const example1Pass = report1.netPayable === 50000 && report1.excessLeave === 0;
const example2Pass = Math.abs(report2.netPayable - 46666.67) < 1 && report2.excessLeave === 2;

if (example1Pass && example2Pass) {
  console.log("✅ ALL TESTS PASSED - Formulas are correct!");
} else {
  console.log("❌ SOME TESTS FAILED");
  if (!example1Pass) console.log("  - Example 1 failed");
  if (!example2Pass) console.log("  - Example 2 failed");
}
