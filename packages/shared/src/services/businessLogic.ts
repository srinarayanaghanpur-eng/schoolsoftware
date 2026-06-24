/**
 * Complete Business Logic for Attendance and Salary Management System
 * 
 * This file contains all the core business logic for:
 * - Attendance marking and validation
 * - Late entry tracking and CL deduction
 * - Casual leave management
 * - Salary calculation
 */

import { Timestamp } from 'firebase-admin/firestore';

// Types
export interface AttendanceRecord {
  teacherId: string;
  date: string;
  month: string;
  year: number;
  status: 'present' | 'late' | 'absent' | 'cl' | 'holiday' | 'not_marked';
  checkInTime?: Timestamp;
  checkOutTime?: Timestamp;
  isLate: boolean;
  lateMinutes?: number;
  source: 'mobile' | 'biometric' | 'admin' | 'manual';
  sourcesUsed: ('mobile' | 'biometric')[];
  gpsVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TeacherData {
  teacherId: string;
  baseMonthlySalary: number;
  casualLeaveBalance: number;
  lateDaysThisMonth: number;
  lateEntriesCount: number;
  absentDaysThisMonth: number;
  presentDaysThisMonth: number;
  casualLeaveDeductedThisMonth: number;
  totalSalaryDeductionThisMonth: number;
}

export interface MonthlySummary {
  teacherId: string;
  month: string;
  year: number;
  totalWorkingDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  lateEntriesCount: number;
  casualLeavesDeductedFromLates: number;
  casualLeavesDeductedFromAbsent: number;
  casualLeavesUsed: number;
  casualLeaveBalanceBefore: number;
  casualLeaveBalanceAfter: number;
  perDaySalary: number;
  perHourSalary: number;
  baseSalary: number;
  totalSalaryDeduction: number;
  deductionFromLates: number;
  deductionFromAbsent: number;
  deductionFromExhaustedCL: number;
  finalPayableSalary: number;
}

export interface SchoolSettings {
  schoolStartTime: string;
  graceMinutesForLate: number;
  defaultLateDeductionMode: 'none' | 'half_day' | 'fixed' | 'after_3_lates_one_day';
  fixedLateDeductionAmount: number;
  latesBeforeCLDeduction: number;
  totalWorkingDaysPerMonth: number;
  casualLeaveAllowancePerMonth: number;
}

/**
 * ATTENDANCE LOGIC
 */

export class AttendanceLogic {
  /**
   * Determine if attendance is late based on check-in time
   * @param checkInTime Check-in timestamp
   * @param schoolStartTime School start time (HH:MM format)
   * @param graceMinutes Grace period in minutes
   * @returns {isLate: boolean, lateMinutes: number}
   */
  static determineIsLate(
    checkInTime: Date,
    schoolStartTime: string,
    graceMinutes: number
  ): { isLate: boolean; lateMinutes: number } {
    const [startHour, startMinute] = schoolStartTime.split(':').map(Number);
    const startTimeInMs = startHour * 60 * 60 * 1000 + startMinute * 60 * 1000;
    
    // Get time of day in milliseconds
    const checkInDate = new Date(checkInTime);
    const checkInTimeOfDay =
      checkInDate.getHours() * 60 * 60 * 1000 +
      checkInDate.getMinutes() * 60 * 1000 +
      checkInDate.getSeconds() * 1000;

    const gracePeriodMs = graceMinutes * 60 * 1000;
    const deadlineMs = startTimeInMs + gracePeriodMs;

    if (checkInTimeOfDay > deadlineMs) {
      const lateMs = checkInTimeOfDay - deadlineMs;
      const lateMinutes = Math.floor(lateMs / (60 * 1000));
      return { isLate: true, lateMinutes };
    }

    return { isLate: false, lateMinutes: 0 };
  }

  /**
   * Merge attendance from multiple sources (mobile + biometric)
   * Takes earliest check-in and latest check-out
   */
  static mergeMultipleSources(
    records: Array<{
      checkInTime?: Date;
      checkOutTime?: Date;
      source: 'mobile' | 'biometric';
    }>
  ): {
    checkInTime?: Date;
    checkOutTime?: Date;
    sourcesUsed: ('mobile' | 'biometric')[];
  } {
    let earliestCheckIn: Date | undefined;
    let latestCheckOut: Date | undefined;
    const sourcesUsed: ('mobile' | 'biometric')[] = [];

    for (const record of records) {
      if (record.checkInTime) {
        if (!earliestCheckIn || record.checkInTime < earliestCheckIn) {
          earliestCheckIn = record.checkInTime;
        }
      }
      if (record.checkOutTime) {
        if (!latestCheckOut || record.checkOutTime > latestCheckOut) {
          latestCheckOut = record.checkOutTime;
        }
      }
      sourcesUsed.push(record.source);
    }

    return {
      checkInTime: earliestCheckIn,
      checkOutTime: latestCheckOut,
      sourcesUsed: [...new Set(sourcesUsed)], // Remove duplicates
    };
  }

  /**
   * Calculate GPS distance from campus
   * Using Haversine formula
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Validate GPS location against geofence
   */
  static isWithinGeofence(
    userLat: number,
    userLon: number,
    campusLat: number,
    campusLon: number,
    radiusMeters: number
  ): boolean {
    const distance = this.calculateDistance(
      userLat,
      userLon,
      campusLat,
      campusLon
    );
    return distance <= radiusMeters;
  }

  /**
   * Calculate working hours from check-in and check-out
   */
  static calculateWorkingHours(
    checkInTime: Date,
    checkOutTime: Date
  ): number {
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  }
}

/**
 * LATE ENTRY AND CASUAL LEAVE LOGIC
 */

export class LateAndLeaveLogic {
  /**
   * Process late entry and update casual leave balance
   * Every 3 late entries = 1 CL deduction
   * 
   * @param currentLateCount Current number of late entries
   * @param settings School settings with latesBeforeCLDeduction
   * @returns {casualLeavesToDeduct: number, newLateCount: number}
   */
  static calculateCLDeductionFromLates(
    currentLateCount: number,
    newLateEntry: boolean,
    settings: SchoolSettings
  ): { casualLeavesToDeduct: number; newLateCount: number } {
    const latesPerCL = settings.latesBeforeCLDeduction || 3;
    let newLateCount = currentLateCount;

    if (newLateEntry) {
      newLateCount = currentLateCount + 1;
    }

    // Calculate how many CLs should be deducted for the new count
    const newDeductedCLs = Math.floor(newLateCount / latesPerCL);
    // Calculate how many CLs were deducted before
    const previousDeductedCLs = Math.floor(currentLateCount / latesPerCL);

    // Only return the new deductions (avoiding duplicate deductions)
    const casualLeavesToDeduct = newDeductedCLs - previousDeductedCLs;

    return { casualLeavesToDeduct, newLateCount };
  }

  /**
   * Calculate CL deduction from absent days
   * 1 absent day = 1 CL deduction
   */
  static calculateCLDeductionFromAbsent(
    absentDaysCount: number
  ): number {
    return absentDaysCount; // 1:1 ratio
  }

  /**
   * Check if casual leave balance is exhausted
   */
  static isCLBalanceExhausted(
    currentBalance: number
  ): boolean {
    return currentBalance <= 0;
  }

  /**
   * Update casual leave balance
   */
  static updateCLBalance(
    currentBalance: number,
    deductionAmount: number
  ): number {
    const newBalance = currentBalance - deductionAmount;
    return Math.max(newBalance, 0); // Never go below 0
  }

  /**
   * Get CL status
   */
  static getCLStatus(
    balance: number,
    totalAllowance: number
  ): 'critical' | 'warning' | 'safe' {
    const percentage = (balance / totalAllowance) * 100;
    if (percentage === 0) return 'critical';
    if (percentage <= 25) return 'warning';
    return 'safe';
  }
}

/**
 * SALARY CALCULATION LOGIC
 */

export class SalaryLogic {
  /**
   * Calculate per-day salary
   * perDaySalary = baseSalary / totalWorkingDays
   */
  static calculatePerDaySalary(
    baseSalary: number,
    totalWorkingDays: number
  ): number {
    if (totalWorkingDays === 0) return 0;
    return baseSalary / totalWorkingDays;
  }

  /**
   * Calculate per-hour salary
   * perHourSalary = perDaySalary / 8 (assuming 8-hour workday)
   */
  static calculatePerHourSalary(
    perDaySalary: number,
    workHoursPerDay: number = 8
  ): number {
    return perDaySalary / workHoursPerDay;
  }

  /**
   * Calculate deduction from absent days
   * deduction = absentDays × perDaySalary
   */
  static calculateDeductionFromAbsent(
    absentDays: number,
    perDaySalary: number
  ): number {
    return absentDays * perDaySalary;
  }

  /**
   * Calculate deduction from late entries based on mode
   */
  static calculateDeductionFromLates(
    lateDays: number,
    lateEntriesCount: number,
    perDaySalary: number,
    deductionMode: string,
    fixedAmount: number
  ): number {
    switch (deductionMode) {
      case 'none':
        return 0;

      case 'half_day':
        // Each late day = 50% of daily salary
        return lateDays * (perDaySalary * 0.5);

      case 'fixed':
        // Fixed amount per late entry
        return lateEntriesCount * fixedAmount;

      case 'after_3_lates_one_day':
      default:
        // Every 3 lates = 1 full day deduction
        const fullDaysFromLates = Math.floor(lateEntriesCount / 3);
        return fullDaysFromLates * perDaySalary;
    }
  }

  /**
   * Calculate deduction from exhausted casual leave
   * If CL balance goes negative, deduct salary for additional days
   */
  static calculateDeductionFromExhaustedCL(
    casualLeavesUsedThisMonth: number,
    casualLeaveAllowancePerMonth: number,
    perDaySalary: number
  ): number {
    if (casualLeavesUsedThisMonth <= casualLeaveAllowancePerMonth) {
      return 0;
    }

    const excessCLDays = casualLeavesUsedThisMonth - casualLeaveAllowancePerMonth;
    return excessCLDays * perDaySalary;
  }

  /**
   * Calculate final payable salary
   * finalSalary = baseSalary - totalDeductions + bonus
   */
  static calculateFinalSalary(
    baseSalary: number,
    totalDeductions: number,
    bonus: number = 0
  ): number {
    return baseSalary - totalDeductions + bonus;
  }

  /**
   * Generate complete monthly salary report
   */
  static generateMonthlySalaryReport(
    teacherId: string,
    teacherName: string,
    employeeId: string,
    baseSalary: number,
    month: string,
    year: number,
    attendanceSummary: {
      presentDays: number;
      lateDays: number;
      absentDays: number;
      lateEntriesCount: number;
      totalWorkingDays: number;
      casualLeavesUsed: number;
      casualLeaveAllowance: number;
    },
    settings: SchoolSettings
  ): MonthlySummary {
    const { totalWorkingDays } = attendanceSummary;
    const perDaySalary = this.calculatePerDaySalary(baseSalary, totalWorkingDays);
    const perHourSalary = this.calculatePerHourSalary(perDaySalary);

    const deductionFromAbsent = this.calculateDeductionFromAbsent(
      attendanceSummary.absentDays,
      perDaySalary
    );

    const deductionFromLates = this.calculateDeductionFromLates(
      attendanceSummary.lateDays,
      attendanceSummary.lateEntriesCount,
      perDaySalary,
      settings.defaultLateDeductionMode,
      settings.fixedLateDeductionAmount
    );

    const deductionFromExhaustedCL = this.calculateDeductionFromExhaustedCL(
      attendanceSummary.casualLeavesUsed,
      attendanceSummary.casualLeaveAllowance,
      perDaySalary
    );

    const totalDeduction =
      deductionFromAbsent + deductionFromLates + deductionFromExhaustedCL;

    const finalPayableSalary = this.calculateFinalSalary(
      baseSalary,
      totalDeduction
    );

    return {
      teacherId,
      month,
      year,
      totalWorkingDays,
      presentDays: attendanceSummary.presentDays,
      lateDays: attendanceSummary.lateDays,
      absentDays: attendanceSummary.absentDays,
      lateEntriesCount: attendanceSummary.lateEntriesCount,
      casualLeavesDeductedFromLates: Math.floor(
        attendanceSummary.lateEntriesCount / settings.latesBeforeCLDeduction
      ),
      casualLeavesDeductedFromAbsent: attendanceSummary.absentDays,
      casualLeavesUsed: attendanceSummary.casualLeavesUsed,
      casualLeaveBalanceBefore: 0, // Will be set from teacher record
      casualLeaveBalanceAfter: 0, // Will be set from teacher record
      perDaySalary,
      perHourSalary,
      baseSalary,
      totalSalaryDeduction: totalDeduction,
      deductionFromLates,
      deductionFromAbsent,
      deductionFromExhaustedCL,
      finalPayableSalary,
    };
  }
}

/**
 * MONTHLY RESET LOGIC
 */

export class MonthlyResetLogic {
  /**
   * Reset monthly counters for a teacher at start of new month
   */
  static resetMonthlyCounters(
    casualLeaveAllowancePerMonth: number
  ): Partial<TeacherData> {
    return {
      presentDaysThisMonth: 0,
      lateDaysThisMonth: 0,
      absentDaysThisMonth: 0,
      lateEntriesCount: 0, // Reset for new month? Or keep cumulative?
      casualLeaveDeductedThisMonth: 0,
      totalSalaryDeductionThisMonth: 0,
    };
  }

  /**
   * Allocate monthly casual leave allowance
   */
  static allocateMonthlyLeaveAllowance(
    currentBalance: number,
    monthlyAllowance: number
  ): number {
    return currentBalance + monthlyAllowance;
  }

  /**
   * Check if month has changed
   */
  static hasMonthChanged(lastProcessedMonth: string, currentMonth: string): boolean {
    return lastProcessedMonth !== currentMonth;
  }
}

/**
 * REPORT GENERATION LOGIC
 */

export class ReportLogic {
  /**
   * Aggregate daily attendance into monthly summary
   */
  static aggregateMonthlyAttendance(
    attendanceRecords: AttendanceRecord[],
    totalWorkingDays: number,
    casualLeaveAllowancePerMonth: number
  ): Omit<MonthlySummary, 'teacherId' | 'month' | 'year' | 'perDaySalary' | 'perHourSalary' | 'baseSalary' | 'totalSalaryDeduction' | 'deductionFromLates' | 'deductionFromAbsent' | 'deductionFromExhaustedCL' | 'finalPayableSalary'> {
    let presentDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    let lateEntriesCount = 0;
    let casualLeavesUsed = 0;

    for (const record of attendanceRecords) {
      if (record.status === 'present') presentDays++;
      if (record.status === 'late') {
        lateDays++;
        lateEntriesCount++;
      }
      if (record.status === 'absent') absentDays++;
      if (record.status === 'cl') casualLeavesUsed++;
    }

    const casualLeavesDeductedFromLates = Math.floor(lateEntriesCount / 3);
    const casualLeavesDeductedFromAbsent = absentDays;

    return {
      totalWorkingDays,
      presentDays,
      lateDays,
      absentDays,
      lateEntriesCount,
      casualLeavesDeductedFromLates,
      casualLeavesDeductedFromAbsent,
      casualLeavesUsed,
      casualLeaveBalanceBefore: 0,
      casualLeaveBalanceAfter: 0,
    };
  }

  /**
   * Calculate statistics for dashboard
   */
  static calculateDashboardStats(attendanceRecords: AttendanceRecord[]) {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter((r) => r.date === today);

    return {
      presentToday: todayRecords.filter((r) => r.status === 'present').length,
      lateToday: todayRecords.filter((r) => r.status === 'late').length,
      absentToday: todayRecords.filter((r) => r.status === 'absent').length,
      notMarkedToday: todayRecords.filter((r) => r.status === 'not_marked').length,
    };
  }

  /**
   * Generate late attendance report
   */
  static generateLateReport(attendanceRecords: AttendanceRecord[]) {
    return attendanceRecords
      .filter((r) => r.status === 'late')
      .map((r) => ({
        teacherId: r.teacherId,
        date: r.date,
        checkInTime: r.checkInTime,
        lateMinutes: r.lateMinutes,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Generate leave deduction report
   */
  static generateLeaveDeductionReport(
    teacherData: TeacherData[],
  ) {
    return teacherData.map((teacher) => ({
      teacherId: teacher.teacherId,
      casualLeaveBalance: teacher.casualLeaveBalance,
      casualLeaveDeductedThisMonth: teacher.casualLeaveDeductedThisMonth,
      absentDays: teacher.absentDaysThisMonth,
      lateDaysConvertedToCL: Math.floor(
        teacher.lateEntriesCount / 3
      ),
    }));
  }
}

/**
 * VALIDATION LOGIC
 */

export class ValidationLogic {
  /**
   * Validate attendance status
   */
  static isValidAttendanceStatus(
    status: string
  ): status is 'present' | 'late' | 'absent' | 'cl' | 'holiday' | 'not_marked' {
    const validStatuses = [
      'present',
      'late',
      'absent',
      'cl',
      'holiday',
      'not_marked',
    ];
    return validStatuses.includes(status);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  static isValidDateFormat(date: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(date)) return false;
    const d = new Date(date);
    return d instanceof Date && !isNaN(d.getTime());
  }

  /**
   * Validate time format (HH:MM)
   */
  static isValidTimeFormat(time: string): boolean {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  }

  /**
   * Validate salary
   */
  static isValidSalary(salary: number): boolean {
    return salary > 0 && Number.isFinite(salary);
  }

  /**
   * Validate GPS coordinates
   */
  static isValidCoordinates(lat: number, lon: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    );
  }

  /**
   * Validate leave dates
   */
  static isValidLeaveRange(startDate: string, endDate: string): boolean {
    if (
      !this.isValidDateFormat(startDate) ||
      !this.isValidDateFormat(endDate)
    ) {
      return false;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end;
  }

  /**
   * Check for duplicate attendance marking
   */
  static isDuplicateAttendance(
    existingRecords: AttendanceRecord[],
    teacherId: string,
    date: string
  ): boolean {
    return existingRecords.some(
      (r) => r.teacherId === teacherId && r.date === date
    );
  }
}

export default {
  AttendanceLogic,
  LateAndLeaveLogic,
  SalaryLogic,
  MonthlyResetLogic,
  ReportLogic,
  ValidationLogic,
};
