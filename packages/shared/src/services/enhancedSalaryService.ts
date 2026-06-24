/**
 * Enhanced Salary Service
 * Complete salary calculation with all deductions and report generation
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';
import {
  SalaryLogic,
  ReportLogic,
  ValidationLogic,
} from './businessLogic';

export class EnhancedSalaryService {
  private db = getFirestore();

  /**
   * Calculate and generate salary report for a teacher for a specific month
   */
  async generateSalaryReport(
    teacherId: string,
    month: string, // Format: YYYY-MM
    baseSalary?: number,
    schoolSettings?: any
  ) {
    try {
      // Parallelize all reads (teacher, summary, settings, CL used) - ~3-4x faster
      const teacherRef = doc(this.db, 'teachers', teacherId);
      const summaryId = `${teacherId}_${month}`;
      const summaryRef = doc(this.db, 'attendance_summary', summaryId);

      const [teacherSnap, summarySnap, settings, casualLeavesUsed] = await Promise.all([
        getDoc(teacherRef),
        getDoc(summaryRef),
        schoolSettings || this.getSchoolSettings(),
        this.getCasualLeavesUsedInMonth(teacherId, month)
      ]);

      if (!teacherSnap.exists()) {
        throw new Error('Teacher not found');
      }

      if (!summarySnap.exists()) {
        throw new Error('Attendance summary not found for this month');
      }

      const teacher = teacherSnap.data();
      const summary = summarySnap.data();
      const finalBaseSalary = baseSalary || teacher.baseMonthlySalary;
      const [year, monthNum] = month.split('-').map(Number);

      // 4. Calculate per-day salary
      const perDaySalary = SalaryLogic.calculatePerDaySalary(
        finalBaseSalary,
        summary.totalWorkingDays
      );
      const perHourSalary = SalaryLogic.calculatePerHourSalary(perDaySalary);

      // 5. Calculate all deductions
      const deductionFromAbsent = SalaryLogic.calculateDeductionFromAbsent(
        summary.absentDays || 0,
        perDaySalary
      );

      const deductionFromLates = SalaryLogic.calculateDeductionFromLates(
        summary.lateDays || 0,
        summary.lateEntriesCount || 0,
        perDaySalary,
        settings.defaultLateDeductionMode || 'after_3_lates_one_day',
        settings.fixedLateDeductionAmount || 0
      );

      const casualLeaveAllowance =
        settings.casualLeaveAllowancePerMonth || 1;
      const deductionFromExhaustedCL =
        SalaryLogic.calculateDeductionFromExhaustedCL(
          casualLeavesUsed,
          casualLeaveAllowance,
          perDaySalary
        );

      const totalDeduction =
        deductionFromAbsent + deductionFromLates + deductionFromExhaustedCL;

      // 6. Calculate final salary
      const netSalary = SalaryLogic.calculateFinalSalary(
        finalBaseSalary,
        totalDeduction,
        0 // No bonus by default
      );

      // 7. Create salary report
      const reportId = `${month}_${teacherId}`;
      const reportData = {
        reportId,
        teacherId,
        month,
        year,
        teacherName: teacher.fullName,
        employeeId: teacher.employeeId,
        
        // Salary components
        baseSalary: finalBaseSalary,
        totalWorkingDays: summary.totalWorkingDays,
        perDaySalary: Math.round(perDaySalary * 100) / 100,
        perHourSalary: Math.round(perHourSalary * 100) / 100,
        
        // Attendance tracking
        presentDays: summary.presentDays || 0,
        lateDays: summary.lateDays || 0,
        absentDays: summary.absentDays || 0,
        casualLeavesUsed: casualLeavesUsed,
        
        // Deduction calculations
        deductionFromAbsent: Math.round(deductionFromAbsent * 100) / 100,
        deductionFromLates: Math.round(deductionFromLates * 100) / 100,
        deductionFromExhaustedCL: Math.round(deductionFromExhaustedCL * 100) / 100,
        totalDeduction: Math.round(totalDeduction * 100) / 100,
        
        // Final salary
        netSalary: Math.round(netSalary * 100) / 100,
        bonus: 0,
        
        // Payment status
        status: 'calculated',
        isApproved: false,
        isPaid: false,
        
        // Metadata
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      return reportData;
    } catch (error) {
      console.error('Error generating salary report:', error);
      throw error;
    }
  }

  /**
   * Save salary report to Firestore
   */
  async saveSalaryReport(reportData: any) {
    try {
      const reportId = reportData.reportId;
      const ref = doc(this.db, 'salary_reports', reportId);
      await setDoc(ref, reportData);

      return {
        success: true,
        reportId,
      };
    } catch (error) {
      console.error('Error saving salary report:', error);
      throw error;
    }
  }

  /**
   * Generate salary reports for all active teachers in a month
   */
  async generateBatchSalaryReports(month: string) {
    try {
      // Get all active teachers
      const teachersRef = collection(this.db, 'teachers');
      const q = query(
        teachersRef,
        where('status', '==', 'active'),
        orderBy('fullName')
      );

      const snap = await getDocs(q);
      const teachers = snap.docs.map((doc) => ({
        ...doc.data(),
        docId: doc.id,
      }));

      const reports = [];
      const settings = await this.getSchoolSettings();

      // Generate reports in parallel instead of sequential (~3x faster for N teachers)
      const reportPromises = teachers.map((teacher) =>
        this.generateSalaryReport(
          teacher.teacherId,
          month,
          teacher.baseMonthlySalary,
          settings
        ).catch((error) => {
          console.error(
            `Error generating report for teacher ${teacher.teacherId}:`,
            error
          );
          return null;
        })
      );

      const generatedReports = await Promise.all(reportPromises);
      const validReports = generatedReports.filter((r) => r !== null);

      // Save all reports in parallel
      await Promise.all(
        validReports.map((reportData) => this.saveSalaryReport(reportData))
      );

      return {
        success: true,
        month,
        totalReportsGenerated: validReports.length,
        reports: validReports,
      };
    } catch (error) {
      console.error('Error generating batch salary reports:', error);
      throw error;
    }
  }

  /**
   * Get salary report for a teacher
   */
  async getSalaryReport(reportId: string) {
    try {
      const ref = doc(this.db, 'salary_reports', reportId);
      const snap = await getDoc(ref);

      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error getting salary report:', error);
      return null;
    }
  }

  /**
   * Get all salary reports for a teacher
   */
  async getTeacherSalaryHistory(teacherId: string, limit: number = 12) {
    try {
      const q = query(
        collection(this.db, 'salary_reports'),
        where('teacherId', '==', teacherId),
        orderBy('month', 'desc')
      );

      const snap = await getDocs(q);
      return snap.docs.slice(0, limit).map((doc) => doc.data());
    } catch (error) {
      console.error('Error getting teacher salary history:', error);
      return [];
    }
  }

  /**
   * Update salary report status
   */
  async updateSalaryReportStatus(
    reportId: string,
    status: 'calculated' | 'approved' | 'paid' | 'cancelled',
    metadata?: {
      approvedBy?: string;
      paidAt?: Date;
      paymentMethod?: string;
      paymentReference?: string;
    }
  ) {
    try {
      const ref = doc(this.db, 'salary_reports', reportId);

      const updateData: any = {
        status,
        updatedAt: Timestamp.now(),
      };

      if (status === 'approved') {
        updateData.isApproved = true;
        updateData.approvedBy = metadata?.approvedBy;
        updateData.approvedAt = Timestamp.now();
      }

      if (status === 'paid') {
        updateData.isPaid = true;
        updateData.paidAt = metadata?.paidAt
          ? Timestamp.fromDate(metadata.paidAt)
          : Timestamp.now();
        updateData.paymentMethod = metadata?.paymentMethod;
        updateData.paymentReference = metadata?.paymentReference;
      }

      await updateDoc(ref, updateData);

      return {
        success: true,
        reportId,
        newStatus: status,
      };
    } catch (error) {
      console.error('Error updating salary report status:', error);
      throw error;
    }
  }

  /**
   * Add manual deduction to salary
   */
  async addManualDeduction(
    reportId: string,
    deductionAmount: number,
    reason: string,
    adminId: string
  ) {
    try {
      const ref = doc(this.db, 'salary_reports', reportId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        throw new Error('Salary report not found');
      }

      const report = snap.data();
      const previousDeduction = report.manualDeduction || 0;
      const totalDeduction =
        (report.totalDeduction || 0) +
        deductionAmount -
        previousDeduction;
      const newNetSalary =
        report.baseSalary - totalDeduction;

      await updateDoc(ref, {
        manualDeduction: previousDeduction + deductionAmount,
        totalDeduction: Math.round(totalDeduction * 100) / 100,
        netSalary: Math.round(newNetSalary * 100) / 100,
        updatedAt: Timestamp.now(),
      });

      // Log audit
      const auditId = `${reportId}_${Timestamp.now().toMillis()}`;
      const auditRef = doc(
        this.db,
        'salary_audit_logs',
        auditId
      );

      await setDoc(auditRef, {
        auditId,
        reportId,
        teacherId: report.teacherId,
        month: report.month,
        action: 'manual_deduction',
        amount: deductionAmount,
        reason,
        adminId,
        timestamp: Timestamp.now(),
      });

      return {
        success: true,
        reportId,
        deductionAdded: deductionAmount,
        newTotalDeduction: Math.round(totalDeduction * 100) / 100,
        newNetSalary: Math.round(newNetSalary * 100) / 100,
      };
    } catch (error) {
      console.error('Error adding manual deduction:', error);
      throw error;
    }
  }

  /**
   * Add bonus to salary
   */
  async addBonus(
    reportId: string,
    bonusAmount: number,
    reason: string,
    adminId: string
  ) {
    try {
      const ref = doc(this.db, 'salary_reports', reportId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        throw new Error('Salary report not found');
      }

      const report = snap.data();
      const previousBonus = report.bonus || 0;
      const newNetSalary =
        report.baseSalary -
        report.totalDeduction +
        previousBonus +
        bonusAmount;

      await updateDoc(ref, {
        bonus: previousBonus + bonusAmount,
        netSalary: Math.round(newNetSalary * 100) / 100,
        updatedAt: Timestamp.now(),
      });

      // Log audit
      const auditId = `${reportId}_${Timestamp.now().toMillis()}`;
      const auditRef = doc(
        this.db,
        'salary_audit_logs',
        auditId
      );

      await setDoc(auditRef, {
        auditId,
        reportId,
        teacherId: report.teacherId,
        month: report.month,
        action: 'bonus_added',
        amount: bonusAmount,
        reason,
        adminId,
        timestamp: Timestamp.now(),
      });

      return {
        success: true,
        reportId,
        bonusAdded: bonusAmount,
        newBonus: previousBonus + bonusAmount,
        newNetSalary: Math.round(newNetSalary * 100) / 100,
      };
    } catch (error) {
      console.error('Error adding bonus:', error);
      throw error;
    }
  }

  /**
   * Get casual leaves used in a month
   */
  private async getCasualLeavesUsedInMonth(
    teacherId: string,
    month: string
  ): Promise<number> {
    try {
      const q = query(
        collection(this.db, 'leave_requests'),
        where('teacherId', '==', teacherId),
        where('status', '==', 'approved')
      );

      const snap = await getDocs(q);
      let totalDays = 0;

      for (const docSnap of snap.docs) {
        const leave = docSnap.data();
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);

        // Check if leave overlaps with the given month
        const [year, monthNum] = month.split('-').map(Number);
        const monthStart = new Date(year, monthNum - 1, 1);
        const monthEnd = new Date(year, monthNum, 0);

        if (
          startDate <= monthEnd &&
          endDate >= monthStart
        ) {
          // Calculate working days in this month for this leave
          const overlapStart = new Date(
            Math.max(startDate.getTime(), monthStart.getTime())
          );
          const overlapEnd = new Date(
            Math.min(endDate.getTime(), monthEnd.getTime())
          );

          const workingDays = this.calculateWorkingDaysInRange(
            overlapStart,
            overlapEnd
          );
          totalDays += workingDays;
        }
      }

      return totalDays;
    } catch (error) {
      console.error('Error getting casual leaves used:', error);
      return 0;
    }
  }

  /**
   * Calculate working days in a date range (excluding weekends)
   */
  private calculateWorkingDaysInRange(
    startDate: Date,
    endDate: Date,
    weeklyOffDay: string = 'Sunday'
  ): number {
    let count = 0;
    const dayToExclude =
      weeklyOffDay === 'Sunday' ? 0 : 6;

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      if (date.getDay() !== dayToExclude) {
        count++;
      }
    }

    return count;
  }

  /**
   * Get school settings
   */
  private async getSchoolSettings() {
    try {
      const ref = doc(this.db, 'school_settings', 'default');
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        throw new Error('School settings not found');
      }

      return snap.data();
    } catch (error) {
      console.error('Error getting school settings:', error);
      // Return default settings
      return {
        schoolStartTime: '09:00',
        graceMinutesForLate: 10,
        defaultLateDeductionMode: 'after_3_lates_one_day',
        fixedLateDeductionAmount: 0,
        casualLeaveAllowancePerMonth: 1,
        totalWorkingDaysPerMonth: 22,
      };
    }
  }

  /**
   * Export salary report to CSV format
   */
  async exportSalaryReportToCSV(reportId: string): Promise<string> {
    try {
      const report = await this.getSalaryReport(reportId);

      if (!report) {
        throw new Error('Salary report not found');
      }

      const csv = `Teacher Salary Report
Report ID,${report.reportId}
Month,${report.month}
Teacher Name,${report.teacherName}
Employee ID,${report.employeeId}

SALARY COMPONENTS
Base Salary,${report.baseSalary}
Per Day Salary,${report.perDaySalary}
Per Hour Salary,${report.perHourSalary}
Total Working Days,${report.totalWorkingDays}

ATTENDANCE
Present Days,${report.presentDays}
Late Days,${report.lateDays}
Absent Days,${report.absentDays}
Casual Leaves Used,${report.casualLeavesUsed}

DEDUCTIONS
From Absent,${report.deductionFromAbsent}
From Lates,${report.deductionFromLates}
From Exhausted CL,${report.deductionFromExhaustedCL}
Total Deduction,${report.totalDeduction}

FINAL SALARY
Net Salary,${report.netSalary}
Bonus,${report.bonus || 0}

PAYMENT STATUS
Status,${report.status}
Approved,${report.isApproved ? 'Yes' : 'No'}
Paid,${report.isPaid ? 'Yes' : 'No'}`;

      return csv;
    } catch (error) {
      console.error('Error exporting salary report:', error);
      throw error;
    }
  }
}

export default new EnhancedSalaryService();
