import { demoAttendance, demoBiometricLogs, demoHolidays, demoTeachers } from "./demoData";

console.log(
  JSON.stringify(
    {
      teachers: demoTeachers,
      attendance: demoAttendance,
      biometric_logs: demoBiometricLogs,
      holidays: demoHolidays
    },
    null,
    2
  )
);
