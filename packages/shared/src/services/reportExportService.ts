import * as XLSX from "xlsx";
import type { AttendanceRecord, BiometricLog, SalaryReport, Teacher } from "../types/models";
import { getApprovedPaidCLDays, getUnpaidAbsentDays, normalizeSalaryReport } from "./salaryService";

function writeWorkbook(rows: Record<string, unknown>[], sheetName: string) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export function buildDailyAttendanceRows(records: AttendanceRecord[], teachers: Teacher[]) {
  return records.map((record) => {
    const teacher = teachers.find((item) => item.id === record.teacherId);
    return {
      Date: record.date,
      "Teacher name": teacher?.fullName ?? record.teacherId,
      "Employee ID": teacher?.employeeId ?? "",
      Subject: teacher?.subject ?? "",
      Status: record.status,
      "Check-in time": record.checkInTime ?? "",
      "Check-out time": record.checkOutTime ?? "",
      Source: record.source,
      "Late minutes": record.lateMinutes,
      "GPS distance": record.distanceFromCampus ?? "",
      Remarks: record.remarks ?? ""
    };
  });
}

export function buildMonthlyAttendanceRows(records: AttendanceRecord[], teachers: Teacher[]) {
  return teachers.map((teacher) => {
    const own = records.filter((record) => record.teacherId === teacher.id);
    const present = own.filter((record) => record.status === "present").length;
    const late = own.filter((record) => record.status === "late").length;
    const cl = own.filter((record) => record.status === "cl").length;
    const absent = own.filter((record) => record.status === "absent" || record.status === "not_marked").length;
    const holidays = own.filter((record) => record.status === "holiday").length;
    const working = Math.max(1, own.length - holidays);
    return {
      "Teacher name": teacher.fullName,
      "Employee ID": teacher.employeeId,
      Subject: teacher.subject,
      "Present days": present,
      "Late days": late,
      "CL days": cl,
      "Absent days": absent,
      Holidays: holidays,
      "Attendance percentage": Math.round(((present + late + cl) / working) * 100)
    };
  });
}

export function buildSalaryRows(reports: SalaryReport[]) {
  return reports.map((input) => {
    const report = normalizeSalaryReport(input);
    return {
      "Teacher Name": report.teacherName,
      "Employee ID": report.employeeId,
      Month: report.month,
      "Base Salary": report.baseSalary,
      "Total Working Days": report.totalWorkingDaysInMonth ?? report.workingDays,
      "Working Days Elapsed": report.workingDaysElapsed ?? report.workingDays,
      "Present Days": report.presentDays,
      "Approved Paid CL Days": getApprovedPaidCLDays(report),
      "Unpaid Absent Days": getUnpaidAbsentDays(report),
      "Daily Rate": report.perDaySalary,
      Deduction: report.salaryDeduction,
      Bonus: report.bonus,
      "Net Payable": report.netPayable,
      Paid: report.salaryStatus && report.salaryStatus !== "Ready" ? report.salaryStatus : report.paid ? "Paid" : "Unpaid",
      "Payment date": report.paidAt ?? "",
      Notes: report.paymentNotes ?? report.calculationWarning ?? ""
    };
  });
}

export function buildBiometricLogRows(logs: BiometricLog[]) {
  return logs.map((log) => ({
    "Device ID": log.deviceId,
    "Biometric user ID": log.biometricUserId,
    "Teacher ID": log.teacherId ?? "",
    Timestamp: log.timestamp,
    Verification: log.verificationType,
    Event: log.eventType,
    Processed: log.processed ? "Yes" : "No",
    Error: log.errorMessage ?? ""
  }));
}

export const exportDailyAttendanceExcel = (records: AttendanceRecord[], teachers: Teacher[]) =>
  writeWorkbook(buildDailyAttendanceRows(records, teachers), "Daily Attendance");

export const exportMonthlyAttendanceExcel = (records: AttendanceRecord[], teachers: Teacher[]) =>
  writeWorkbook(buildMonthlyAttendanceRows(records, teachers), "Monthly Attendance");

export const exportSalaryExcel = (reports: SalaryReport[]) => writeWorkbook(buildSalaryRows(reports), "Salary");

export const exportBiometricLogsExcel = (logs: BiometricLog[]) => writeWorkbook(buildBiometricLogRows(logs), "Biometric Logs");
