/**
 * SALARY CALCULATION TESTS
 * Verify all CL and salary calculations match the business requirements
 * 
 * FORMULAS VERIFIED:
 * - CL Used = absents + floor(lates / 3)
 * - Remaining CL = max(0, 3 - totalClUsed)
 * - Excess Leave = max(0, totalClUsed - 3)
 * - Salary Deduction = excessLeave × dailySalary
 * - Net Salary = baseSalary - deduction + bonus
 */

import { calculateMonthlySalary, type SalaryCalculationInput } from "../services/salaryService";
import type { AttendanceRecord, Holiday, Teacher, SchoolSettings } from "../types/models";

// Test helpers
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

// ============================================================================
// TEST SUITE 1: CL CALCULATION FROM ABSENTS
// ============================================================================

export function testCLFromAbsents() {
  const tests = [
    {
      name: "No absents: 0 CL used",
      absentDays: 0,
      lateEntries: 0,
      expectedTotalClUsed: 0,
      expectedRemainingCl: 3,
      expectedExcessLeave: 0,
    },
    {
      name: "1 absent: 1 CL used",
      absentDays: 1,
      lateEntries: 0,
      expectedTotalClUsed: 1,
      expectedRemainingCl: 2,
      expectedExcessLeave: 0,
    },
    {
      name: "2 absents: 2 CL used",
      absentDays: 2,
      lateEntries: 0,
      expectedTotalClUsed: 2,
      expectedRemainingCl: 1,
      expectedExcessLeave: 0,
    },
    {
      name: "3 absents: 3 CL used (allowance exhausted)",
      absentDays: 3,
      lateEntries: 0,
      expectedTotalClUsed: 3,
      expectedRemainingCl: 0,
      expectedExcessLeave: 0,
    },
    {
      name: "4 absents: 1 excess leave",
      absentDays: 4,
      lateEntries: 0,
      expectedTotalClUsed: 4,
      expectedRemainingCl: 0,
      expectedExcessLeave: 1,
    },
    {
      name: "5 absents: 2 excess leave",
      absentDays: 5,
      lateEntries: 0,
      expectedTotalClUsed: 5,
      expectedRemainingCl: 0,
      expectedExcessLeave: 2,
    },
  ];

  console.log("\n=== TEST SUITE 1: CL FROM ABSENTS ===");
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const records: AttendanceRecord[] = [];
    
    // Create present records
    const presentDays = 20;
    for (let i = 0; i < presentDays; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "present",
      }));
    }
    
    // Create absent records
    for (let i = 0; i < test.absentDays; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(presentDays + i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "absent",
      }));
    }
    
    // Create late records
    for (let i = 0; i < test.lateEntries; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(presentDays + test.absentDays + i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "late",
        isLate: true,
        lateMinutes: 15,
      }));
    }

    const input: SalaryCalculationInput = {
      teacher: createTeacher(),
      records,
      holidays: [],
      month: "2026-06",
      settings: createSettings(),
    };

    const report = calculateMonthlySalary(input);

    const totalClUsedMatch = report.totalClUsed === test.expectedTotalClUsed;
    const remainingClMatch = report.remainingCl === test.expectedRemainingCl;
    const excessLeaveMatch = report.excessLeave === test.expectedExcessLeave;

    if (totalClUsedMatch && remainingClMatch && excessLeaveMatch) {
      console.log(`✅ PASS: ${test.name}`);
      console.log(`   Total CL Used: ${report.totalClUsed}, Remaining: ${report.remainingCl}, Excess: ${report.excessLeave}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Expected: Total=${test.expectedTotalClUsed}, Remaining=${test.expectedRemainingCl}, Excess=${test.expectedExcessLeave}`);
      console.log(`   Got: Total=${report.totalClUsed}, Remaining=${report.remainingCl}, Excess=${report.excessLeave}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// ============================================================================
// TEST SUITE 2: CL CALCULATION FROM LATE ENTRIES
// ============================================================================

export function testCLFromLates() {
  const tests = [
    {
      name: "1 late: 0 CL used (need 3)",
      lateEntries: 1,
      expectedClUsedFromLate: 0,
      expectedTotalClUsed: 0,
    },
    {
      name: "2 lates: 0 CL used (need 3)",
      lateEntries: 2,
      expectedClUsedFromLate: 0,
      expectedTotalClUsed: 0,
    },
    {
      name: "3 lates: 1 CL used",
      lateEntries: 3,
      expectedClUsedFromLate: 1,
      expectedTotalClUsed: 1,
    },
    {
      name: "4 lates: 1 CL used (need 6 for 2nd)",
      lateEntries: 4,
      expectedClUsedFromLate: 1,
      expectedTotalClUsed: 1,
    },
    {
      name: "6 lates: 2 CL used",
      lateEntries: 6,
      expectedClUsedFromLate: 2,
      expectedTotalClUsed: 2,
    },
    {
      name: "9 lates: 3 CL used (allowance exhausted)",
      lateEntries: 9,
      expectedClUsedFromLate: 3,
      expectedTotalClUsed: 3,
    },
  ];

  console.log("\n=== TEST SUITE 2: CL FROM LATES ===");
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const records: AttendanceRecord[] = [];
    
    // Create present records
    const presentDays = 20;
    for (let i = 0; i < presentDays; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "present",
      }));
    }
    
    // Create late records
    for (let i = 0; i < test.lateEntries; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(presentDays + i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "late",
        isLate: true,
        lateMinutes: 15,
      }));
    }

    const input: SalaryCalculationInput = {
      teacher: createTeacher(),
      records,
      holidays: [],
      month: "2026-06",
      settings: createSettings(),
    };

    const report = calculateMonthlySalary(input);

    const clUsedFromLateMatch = report.clUsedFromLate === test.expectedClUsedFromLate;
    const totalClUsedMatch = report.totalClUsed === test.expectedTotalClUsed;

    if (clUsedFromLateMatch && totalClUsedMatch) {
      console.log(`✅ PASS: ${test.name}`);
      console.log(`   CL from Lates: ${report.clUsedFromLate}, Total CL Used: ${report.totalClUsed}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Expected: From Lates=${test.expectedClUsedFromLate}, Total=${test.expectedTotalClUsed}`);
      console.log(`   Got: From Lates=${report.clUsedFromLate}, Total=${report.totalClUsed}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// ============================================================================
// TEST SUITE 3: SALARY DEDUCTION FROM EXCESS LEAVE
// ============================================================================

export function testSalaryDeductions() {
  const tests = [
    {
      name: "Example 1: 6 lates + 1 absent = 0 excess leave = ₹0 deduction",
      baseSalary: 50000,
      workingDays: 30,
      absentDays: 1,
      lateEntries: 6,
      expectedClUsed: 3, // 1 + floor(6/3) = 3
      expectedExcessLeave: 0,
      expectedDeduction: 0,
      expectedNetSalary: 50000,
    },
    {
      name: "Example 2: 9 lates + 2 absents = 2 excess leave = ₹3333.34 deduction",
      baseSalary: 50000,
      workingDays: 30,
      absentDays: 2,
      lateEntries: 9,
      expectedClUsed: 5, // 2 + floor(9/3) = 5
      expectedExcessLeave: 2,
      expectedDeduction: 3333.33,
      expectedNetSalary: 46666.67,
    },
    {
      name: "4 absents = 1 excess leave = ₹1666.67 deduction",
      baseSalary: 50000,
      workingDays: 30,
      absentDays: 4,
      lateEntries: 0,
      expectedClUsed: 4,
      expectedExcessLeave: 1,
      expectedDeduction: 1666.67,
      expectedNetSalary: 48333.33,
    },
  ];

  console.log("\n=== TEST SUITE 3: SALARY DEDUCTIONS ===");
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const records: AttendanceRecord[] = [];
    
    // Create present records
    const presentDays = 20;
    for (let i = 0; i < presentDays; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "present",
      }));
    }
    
    // Create absent records
    for (let i = 0; i < test.absentDays; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(presentDays + i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "absent",
      }));
    }
    
    // Create late records
    for (let i = 0; i < test.lateEntries; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(presentDays + test.absentDays + i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "late",
        isLate: true,
        lateMinutes: 15,
      }));
    }

    const input: SalaryCalculationInput = {
      teacher: createTeacher({ baseSalary: test.baseSalary }),
      records,
      holidays: [],
      month: "2026-06",
      settings: createSettings(),
    };

    const report = calculateMonthlySalary(input);

    const clUsedMatch = report.totalClUsed === test.expectedClUsed;
    const excessLeaveMatch = report.excessLeave === test.expectedExcessLeave;
    const deductionMatch = Math.abs(report.excessLeaveDeduction - test.expectedDeduction) < 1; // Allow ±1 rounding
    const netSalaryMatch = Math.abs(report.netPayable - test.expectedNetSalary) < 1;

    if (clUsedMatch && excessLeaveMatch && deductionMatch && netSalaryMatch) {
      console.log(`✅ PASS: ${test.name}`);
      console.log(`   CL Used: ${report.totalClUsed}, Excess: ${report.excessLeave}, Deduction: ₹${report.excessLeaveDeduction}, Net: ₹${report.netPayable}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Expected: ClUsed=${test.expectedClUsed}, Excess=${test.expectedExcessLeave}, Deduction=₹${test.expectedDeduction}, Net=₹${test.expectedNetSalary}`);
      console.log(`   Got: ClUsed=${report.totalClUsed}, Excess=${report.excessLeave}, Deduction=₹${report.excessLeaveDeduction}, Net=₹${report.netPayable}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// ============================================================================
// TEST SUITE 4: EDGE CASES
// ============================================================================

export function testEdgeCases() {
  const tests = [
    {
      name: "Perfect attendance: all present, 0 deduction",
      absentDays: 0,
      lateEntries: 0,
      expectedClUsed: 0,
      expectedDeduction: 0,
      expectedNetSalary: 50000,
    },
    {
      name: "All absent: max deduction",
      absentDays: 30,
      lateEntries: 0,
      expectedClUsed: 30,
      expectedExcessLeave: 27,
      expectedDeduction: 45000, // 27 × 1666.67
    },
    {
      name: "Mixed: 2 absent + 6 lates = 3 total + 0 excess",
      absentDays: 2,
      lateEntries: 6,
      expectedClUsed: 3,
      expectedExcessLeave: 0,
      expectedDeduction: 0,
    },
  ];

  console.log("\n=== TEST SUITE 4: EDGE CASES ===");
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const records: AttendanceRecord[] = [];
    const presentDays = 30 - test.absentDays - test.lateEntries;

    for (let i = 0; i < presentDays; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "present",
      }));
    }

    for (let i = 0; i < test.absentDays; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(presentDays + i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "absent",
      }));
    }

    for (let i = 0; i < test.lateEntries; i++) {
      records.push(createAttendanceRecord({
        date: `2026-06-${String(presentDays + test.absentDays + i + 1).padStart(2, "0")}`,
        month: "2026-06",
        status: "late",
        isLate: true,
        lateMinutes: 15,
      }));
    }

    const input: SalaryCalculationInput = {
      teacher: createTeacher(),
      records,
      holidays: [],
      month: "2026-06",
      settings: createSettings(),
    };

    const report = calculateMonthlySalary(input);

    const clUsedMatch = report.totalClUsed === test.expectedClUsed;
    let deductionMatch = true;
    if (test.expectedDeduction !== undefined) {
      deductionMatch = Math.abs(report.excessLeaveDeduction - test.expectedDeduction) < 50;
    }

    if (clUsedMatch && deductionMatch) {
      console.log(`✅ PASS: ${test.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${test.name}`);
      console.log(`   Expected: ClUsed=${test.expectedClUsed}, Deduction≈₹${test.expectedDeduction}`);
      console.log(`   Got: ClUsed=${report.totalClUsed}, Deduction=₹${report.excessLeaveDeduction}`);
      failed++;
    }
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runAllTests() {
  console.log("=" .repeat(80));
  console.log("SALARY CALCULATION VERIFICATION TESTS");
  console.log("=" .repeat(80));

  const results = [
    testCLFromAbsents(),
    testCLFromLates(),
    testSalaryDeductions(),
    testEdgeCases(),
  ];

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  console.log("\n" + "=" .repeat(80));
  console.log(`OVERALL RESULTS: ${totalPassed} passed, ${totalFailed} failed`);
  console.log("=" .repeat(80));

  return {
    totalPassed,
    totalFailed,
    allPassed: totalFailed === 0,
  };
}

// For Node.js execution
if (typeof require !== "undefined" && require.main === module) {
  runAllTests();
}

// Direct ESM execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}
