import {
  demoAttendance,
  demoBiometricLogs,
  demoSalaryReports,
  demoTeachers,
  type DashboardSummary
} from "@sri-narayana/shared";

export const demoDashboardSummary: DashboardSummary = {
  totalTeachers: demoTeachers.length,
  presentToday: demoAttendance.filter((item) => item.status === "present").length,
  absentToday: demoTeachers.length - demoAttendance.length,
  lateToday: demoAttendance.filter((item) => item.status === "late").length,
  clToday: demoAttendance.filter((item) => item.status === "cl").length,
  notMarkedToday: Math.max(0, demoTeachers.length - demoAttendance.length),
  totalSalaryPayable: demoSalaryReports.reduce((sum, item) => sum + item.netPayable, 0),
  salaryPaid: demoSalaryReports.filter((item) => item.paid).reduce((sum, item) => sum + item.netPayable, 0),
  salaryPending: demoSalaryReports.filter((item) => !item.paid).reduce((sum, item) => sum + item.netPayable, 0),
  biometricEntriesToday: demoBiometricLogs.length,
  mobileEntriesToday: demoAttendance.filter((item) => item.sourcesUsed.includes("mobile")).length
};

export const attendanceTrend = [
  { day: "Mon", present: 42, late: 3, absent: 2 },
  { day: "Tue", present: 44, late: 2, absent: 1 },
  { day: "Wed", present: 41, late: 4, absent: 2 },
  { day: "Thu", present: 45, late: 1, absent: 1 },
  { day: "Fri", present: 43, late: 2, absent: 2 }
];

export const salaryTrend = [
  { month: "Jan", payable: 1260000 },
  { month: "Feb", payable: 1284000 },
  { month: "Mar", payable: 1271000 },
  { month: "Apr", payable: 1292000 },
  { month: "May", payable: demoDashboardSummary.totalSalaryPayable }
];
