import { calculateMonthlySalary, type SalaryCalculationInput } from "../services/salaryService";
import type { AttendanceRecord, Holiday, LeaveRequest, Teacher, SchoolSettings } from "../types/models";

const TEST_MONTH = "2026-06";
const WORKING_DAYS = 30;

const createTeacher = (overrides?: Partial<Teacher>): Teacher => ({
  id: "T001",
  fullName: "Test Teacher",
  email: "teacher@school.com",
  internalEmail: "teacher@school.com",
  phone: "9876543210",
  subject: "Mathematics",
  employeeId: "E001",
  baseSalary: 30000,
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

const createLeaveRequest = (overrides?: Partial<LeaveRequest>): LeaveRequest => ({
  id: "LR001",
  teacherId: "T001",
  teacherName: "Test Teacher",
  employeeId: "E001",
  startDate: "2026-06-05",
  endDate: "2026-06-05",
  reason: "Personal leave",
  status: "approved",
  requestedAt: "2026-06-01T00:00:00Z",
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

function padDay(day: number): string {
  return String(day).padStart(2, "0");
}

function dateStr(day: number): string {
  return `${TEST_MONTH}-${padDay(day)}`;
}

function presentRecords(fromDay: number, toDay: number): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  for (let day = fromDay; day <= toDay; day++) {
    records.push(createAttendanceRecord({
      date: dateStr(day),
      month: TEST_MONTH,
      status: "present",
    }));
  }
  return records;
}

function absentRecords(days: number[]): AttendanceRecord[] {
  return days.map((day) => createAttendanceRecord({
    date: dateStr(day),
    month: TEST_MONTH,
    status: "absent",
  }));
}

function lateRecords(days: number[]): AttendanceRecord[] {
  return days.map((day) => createAttendanceRecord({
    date: dateStr(day),
    month: TEST_MONTH,
    status: "late",
    isLate: true,
    lateMinutes: 15,
  }));
}

function presentWithCheckin(day: number): AttendanceRecord {
  return createAttendanceRecord({
    date: dateStr(day),
    month: TEST_MONTH,
    status: "present",
    checkInTime: "09:00:00",
  });
}

// ============================================================================
// TEST SUITE 1: PLAIN ABSENT
// ============================================================================

export function testPlainAbsent() {
  console.log("\n=== TEST SUITE 1: PLAIN ABSENT ===");

  const records = [
    ...presentRecords(1, 29),
    ...absentRecords([30]),
  ];

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);
  const perDay = 30000 / WORKING_DAYS; // 1000
  const expectedDeduction = perDay;
  const expectedNet = 30000 - perDay;

  const passed =
    report.plainAbsentDays === 1 &&
    report.totalClUsed === 0 &&
    report.unpaidDeductionDays === 1 &&
    Math.abs(report.salaryDeduction - expectedDeduction) < 1 &&
    Math.abs(report.netPayable - expectedNet) < 1;

  if (passed) {
    console.log(`✅ PASS: 1 plain absent day deducts ₹${expectedDeduction}, net = ₹${expectedNet}`);
  } else {
    console.log(`❌ FAIL: plainAbsentDays=${report.plainAbsentDays}, totalClUsed=${report.totalClUsed}, deduction=${report.salaryDeduction}, net=${report.netPayable}`);
    console.log(`   Expected: plainAbsentDays=1, deduction≈${expectedDeduction}, net≈${expectedNet}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 2: APPROVED LEAVE WITH NO CHECK-IN
// ============================================================================

export function testApprovedLeaveNoCheckin() {
  console.log("\n=== TEST SUITE 2: APPROVED LEAVE NO CHECK-IN ===");

  const records = presentRecords(1, 29);

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    leaveRequests: [
      createLeaveRequest({ startDate: dateStr(30), endDate: dateStr(30) }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);

  const passed =
    report.approvedLeaveCLDays === 1 &&
    report.attendedApprovedLeaveDays === 0 &&
    report.totalClUsed === 1 &&
    report.paidCLDays === 1 &&
    report.plainAbsentDays === 0 &&
    report.unpaidDeductionDays === 0 &&
    report.salaryDeduction === 0 &&
    report.netPayable === 30000;

  if (passed) {
    console.log("✅ PASS: 1 approved leave without check-in consumes 1 CL, no deduction");
  } else {
    console.log(`❌ FAIL: approvedLeaveCLDays=${report.approvedLeaveCLDays}, totalClUsed=${report.totalClUsed}, deduction=${report.salaryDeduction}, net=${report.netPayable}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 3: APPROVED LEAVE BUT CHECKED IN
// ============================================================================

export function testApprovedLeaveWithCheckin() {
  console.log("\n=== TEST SUITE 3: APPROVED LEAVE WITH CHECK-IN ===");

  const records = [
    ...presentRecords(1, 4),
    presentWithCheckin(5),
    ...presentRecords(6, 30),
  ];

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    leaveRequests: [
      createLeaveRequest({ startDate: dateStr(5), endDate: dateStr(5) }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);

  const passed =
    report.approvedLeaveCLDays === 0 &&
    report.attendedApprovedLeaveDays === 1 &&
    report.totalClUsed === 0 &&
    report.plainAbsentDays === 0 &&
    report.salaryDeduction === 0 &&
    report.netPayable === 30000;

  if (passed) {
    console.log("✅ PASS: approved leave with check-in does not consume CL, no deduction");
  } else {
    console.log(`❌ FAIL: attendedLeave=${report.attendedApprovedLeaveDays}, totalClUsed=${report.totalClUsed}, deduction=${report.salaryDeduction}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 4: LATE-DERIVED CL
// ============================================================================

export function testLateDerivedCL() {
  console.log("\n=== TEST SUITE 4: LATE-DERIVED CL ===");

  const records = [
    ...presentRecords(1, 27),
    ...lateRecords([28, 29, 30]),
  ];

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);

  const passed =
    report.lateDerivedCLDays === 1 &&
    report.approvedLeaveCLDays === 0 &&
    report.totalClUsed === 1 &&
    report.paidCLDays === 1 &&
    report.plainAbsentDays === 0 &&
    report.unpaidDeductionDays === 0 &&
    report.salaryDeduction === 0 &&
    report.netPayable === 30000;

  if (passed) {
    console.log("✅ PASS: 3 late days = 1 late-derived CL, no deduction");
  } else {
    console.log(`❌ FAIL: lateDerivedCL=${report.lateDerivedCLDays}, totalClUsed=${report.totalClUsed}, deduction=${report.salaryDeduction}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 5: CL BUCKET SHARED (approved leave + late-derived = 3)
// ============================================================================

export function testCLBucketShared() {
  console.log("\n=== TEST SUITE 5: CL BUCKET SHARED ===");

  const records = [
    ...presentRecords(1, 25),
    ...lateRecords([26, 27, 28]),
  ];

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    leaveRequests: [
      createLeaveRequest({ startDate: dateStr(29), endDate: dateStr(30) }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);

  const passed =
    report.approvedLeaveCLDays === 2 &&
    report.lateDerivedCLDays === 1 &&
    report.totalClUsed === 3 &&
    report.paidCLDays === 3 &&
    report.excessCLDays === 0 &&
    report.plainAbsentDays === 0 &&
    report.unpaidDeductionDays === 0 &&
    report.salaryDeduction === 0 &&
    report.netPayable === 30000;

  if (passed) {
    console.log("✅ PASS: 2 leave CL + 1 late CL = 3 total, within allowance, no deduction");
  } else {
    console.log(`❌ FAIL: totalClUsed=${report.totalClUsed}, excess=${report.excessCLDays}, deduction=${report.salaryDeduction}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 6: CL EXCEEDED
// ============================================================================

export function testCLExceeded() {
  console.log("\n=== TEST SUITE 6: CL EXCEEDED ===");

  const records = [
    ...presentRecords(1, 24),
    ...lateRecords([25, 26, 27]),
  ];

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    leaveRequests: [
      createLeaveRequest({ startDate: dateStr(28), endDate: dateStr(30) }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);
  const perDay = 30000 / WORKING_DAYS;

  const passed =
    report.approvedLeaveCLDays === 3 &&
    report.lateDerivedCLDays === 1 &&
    report.totalClUsed === 4 &&
    report.paidCLDays === 3 &&
    report.excessCLDays === 1 &&
    report.plainAbsentDays === 0 &&
    report.unpaidDeductionDays === 1 &&
    Math.abs(report.salaryDeduction - perDay) < 1 &&
    Math.abs(report.netPayable - (30000 - perDay)) < 1;

  if (passed) {
    console.log(`✅ PASS: totalCLUsed=4, excess=1, deduction=₹${perDay}`);
  } else {
    console.log(`❌ FAIL: totalClUsed=${report.totalClUsed}, excess=${report.excessCLDays}, deduction=${report.salaryDeduction}, net=${report.netPayable}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 7: APPROVED LEAVE + PLAIN ABSENT
// ============================================================================

export function testApprovedLeaveAndAbsent() {
  console.log("\n=== TEST SUITE 7: APPROVED LEAVE + PLAIN ABSENT ===");

  const records = [
    ...presentRecords(1, 28),
    ...absentRecords([29]),
  ];

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    leaveRequests: [
      createLeaveRequest({ startDate: dateStr(30), endDate: dateStr(30) }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);
  const perDay = 30000 / WORKING_DAYS;

  const passed =
    report.approvedLeaveCLDays === 1 &&
    report.plainAbsentDays === 1 &&
    report.totalClUsed === 1 &&
    report.paidCLDays === 1 &&
    report.excessCLDays === 0 &&
    report.unpaidDeductionDays === 1 &&
    Math.abs(report.salaryDeduction - perDay) < 1 &&
    Math.abs(report.netPayable - (30000 - perDay)) < 1;

  if (passed) {
    console.log(`✅ PASS: 1 day CL (leave), 1 day plain absent, deduction=₹${perDay}`);
  } else {
    console.log(`❌ FAIL: approvedLeaveCL=${report.approvedLeaveCLDays}, plainAbsent=${report.plainAbsentDays}, deduction=${report.salaryDeduction}, net=${report.netPayable}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 8: PENDING / REJECTED LEAVE - treated as plain absent
// ============================================================================

export function testPendingRejectedLeave() {
  console.log("\n=== TEST SUITE 8: PENDING/REJECTED LEAVE ===");

  const records = [
    ...presentRecords(1, 29),
    ...absentRecords([30]),
  ];

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    leaveRequests: [
      createLeaveRequest({ startDate: dateStr(30), endDate: dateStr(30), status: "pending" }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);
  const perDay = 30000 / WORKING_DAYS;

  const pendingPassed =
    report.plainAbsentDays === 1 &&
    report.approvedLeaveCLDays === 0 &&
    report.totalClUsed === 0 &&
    Math.abs(report.salaryDeduction - perDay) < 1;

  // Also test rejected leave
  const records2 = [
    ...presentRecords(1, 29),
    ...absentRecords([30]),
  ];

  const input2: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records: records2,
    leaveRequests: [
      createLeaveRequest({ startDate: dateStr(30), endDate: dateStr(30), status: "rejected" }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report2 = calculateMonthlySalary(input2);

  const rejectedPassed =
    report2.plainAbsentDays === 1 &&
    report2.approvedLeaveCLDays === 0 &&
    report2.totalClUsed === 0 &&
    Math.abs(report2.salaryDeduction - perDay) < 1;

  if (pendingPassed && rejectedPassed) {
    console.log(`✅ PASS: pending/rejected leave is treated as plain absent, deduction=₹${perDay}`);
  } else {
    console.log(`❌ FAIL: pending - plainAbsent=${report.plainAbsentDays}, cl=${report.approvedLeaveCLDays}`);
    console.log(`   rejected - plainAbsent=${report2.plainAbsentDays}, cl=${report2.approvedLeaveCLDays}`);
  }

  return (pendingPassed && rejectedPassed) ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// TEST SUITE 9: DATE RANGE LEAVE REQUEST
// ============================================================================

export function testDateRangeLeave() {
  console.log("\n=== TEST SUITE 9: DATE RANGE LEAVE REQUEST ===");

  const records = presentRecords(1, 25);

  const input: SalaryCalculationInput = {
    teacher: createTeacher({ baseSalary: 30000 }),
    records,
    leaveRequests: [
      createLeaveRequest({
        startDate: dateStr(26),
        endDate: dateStr(30),
      }),
    ],
    holidays: [],
    month: TEST_MONTH,
    settings: createSettings(),
  };

  const report = calculateMonthlySalary(input);

  const passed =
    report.approvedLeaveCLDays === 5 &&
    report.attendedApprovedLeaveDays === 0 &&
    report.totalClUsed === 5 &&
    report.paidCLDays === 3 &&
    report.excessCLDays === 2 &&
    report.plainAbsentDays === 0 &&
    report.unpaidDeductionDays === 2;

  if (passed) {
    console.log("✅ PASS: 5-day leave range, totalCLUsed=5, paid=3, excess=2");
  } else {
    console.log(`❌ FAIL: approvedLeaveCL=${report.approvedLeaveCLDays}, totalClUsed=${report.totalClUsed}, paid=${report.paidCLDays}, excess=${report.excessCLDays}`);
  }

  return passed ? { passed: 1, failed: 0 } : { passed: 0, failed: 1 };
}

// ============================================================================
// EXTRA: EDGE CASES
// ============================================================================

export function testEdgeCases() {
  console.log("\n=== TEST SUITE: EDGE CASES ===");

  let passed = 0;
  let failed = 0;

  // Edge 1: Perfect attendance
  {
    const records = presentRecords(1, 30);
    const input: SalaryCalculationInput = {
      teacher: createTeacher({ baseSalary: 30000 }),
      records,
      holidays: [],
      month: TEST_MONTH,
      settings: createSettings(),
    };
    const report = calculateMonthlySalary(input);
    if (report.plainAbsentDays === 0 && report.totalClUsed === 0 && report.salaryDeduction === 0 && report.netPayable === 30000) {
      console.log("✅ PASS: Perfect attendance, no deduction");
      passed++;
    } else {
      console.log(`❌ FAIL: Perfect attendance - deduction=${report.salaryDeduction}, net=${report.netPayable}`);
      failed++;
    }
  }

  // Edge 2: Part-time staff - uses own base salary
  {
    const records = presentRecords(1, 30);
    const input: SalaryCalculationInput = {
      teacher: createTeacher({ baseSalary: 15000 }),
      records,
      holidays: [],
      month: TEST_MONTH,
      settings: createSettings(),
    };
    const report = calculateMonthlySalary(input);
    if (report.baseSalary === 15000 && report.netPayable === 15000) {
      console.log("✅ PASS: Part-time staff uses own base salary (15000)");
      passed++;
    } else {
      console.log(`❌ FAIL: Part-time - base=${report.baseSalary}, net=${report.netPayable}`);
      failed++;
    }
  }

  // Edge 3: 1 or 2 lates should not create CL
  {
    const records = [
      ...presentRecords(1, 28),
      ...lateRecords([29]),
    ];
    const input: SalaryCalculationInput = {
      teacher: createTeacher({ baseSalary: 30000 }),
      records,
      holidays: [],
      month: TEST_MONTH,
      settings: createSettings(),
    };
    const report = calculateMonthlySalary(input);
    if (report.lateDerivedCLDays === 0 && report.totalClUsed === 0) {
      console.log("✅ PASS: 1 late = 0 CL (need 3)");
      passed++;
    } else {
      console.log(`❌ FAIL: 1 late gave ${report.lateDerivedCLDays} CL`);
      failed++;
    }
  }

  // Edge 4: 2 lates should not create CL
  {
    const records = [
      ...presentRecords(1, 28),
      ...lateRecords([29, 30]),
    ];
    const input: SalaryCalculationInput = {
      teacher: createTeacher({ baseSalary: 30000 }),
      records,
      holidays: [],
      month: TEST_MONTH,
      settings: createSettings(),
    };
    const report = calculateMonthlySalary(input);
    if (report.lateDerivedCLDays === 0 && report.totalClUsed === 0) {
      console.log("✅ PASS: 2 lates = 0 CL (need 3)");
      passed++;
    } else {
      console.log(`❌ FAIL: 2 lates gave ${report.lateDerivedCLDays} CL`);
      failed++;
    }
  }

  // Edge 5: Date range spanning outside month - ignore dates outside
  {
    const records = presentRecords(1, 28);
    const input: SalaryCalculationInput = {
      teacher: createTeacher({ baseSalary: 30000 }),
      records,
      leaveRequests: [
        createLeaveRequest({
          startDate: "2026-05-30",
          endDate: "2026-06-02",
        }),
      ],
      holidays: [],
      month: TEST_MONTH,
      settings: createSettings(),
    };
    const report = calculateMonthlySalary(input);
    // Only June 1-2 should be counted (2 days in June)
    if (report.approvedLeaveCLDays === 2 && report.totalClUsed === 2) {
      console.log("✅ PASS: Date range spans prev month, only June 1-2 counted");
      passed++;
    } else {
      console.log(`❌ FAIL: Date range spanning prev month - approvedLeaveCL=${report.approvedLeaveCLDays}`);
      failed++;
    }
  }

  console.log(`\nEdge Cases: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

export function runAllTests() {
  console.log("=" .repeat(80));
  console.log("SALARY CALCULATION TESTS");
  console.log("=" .repeat(80));

  const results = [
    testPlainAbsent(),
    testApprovedLeaveNoCheckin(),
    testApprovedLeaveWithCheckin(),
    testLateDerivedCL(),
    testCLBucketShared(),
    testCLExceeded(),
    testApprovedLeaveAndAbsent(),
    testPendingRejectedLeave(),
    testDateRangeLeave(),
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

const isMainModule = () => {
  try {
    return typeof process !== "undefined" && process.argv?.[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
  } catch {
    return typeof require !== "undefined" && require.main === module;
  }
};

if (isMainModule()) {
  runAllTests();
}
