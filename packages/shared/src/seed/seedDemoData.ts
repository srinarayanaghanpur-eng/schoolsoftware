import { demoAttendance, demoBiometricLogs, demoHolidays, demoSalaryReports, demoTeachers } from "./demoData";

console.log(
  JSON.stringify(
    {
      teachers: demoTeachers,
      attendance: demoAttendance,
      biometric_logs: demoBiometricLogs,
      holidays: demoHolidays,
      salary_reports: demoSalaryReports
    },
    null,
    2
  )
);
