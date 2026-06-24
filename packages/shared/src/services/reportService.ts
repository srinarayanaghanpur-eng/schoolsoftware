/**
 * Report Generation Service
 * Creates comprehensive reports for attendance, salary, and analytics
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { ReportLogic } from './businessLogic';

export class ReportService {
  private db = getFirestore();

  /**
   * Generate Daily Attendance Report
   */
  async generateDailyAttendanceReport(date: string) {
    try {
      const q = query(
        collection(this.db, 'attendance'),
        where('date', '==', date),
        orderBy('teacherId')
      );

      const snap = await getDocs(q);
      const records = snap.docs.map((doc) => doc.data());

      const stats = {
        date,
        totalRecords: records.length,
        presentCount: records.filter((r) => r.status === 'present').length,
        lateCount: records.filter((r) => r.status === 'late').length,
        absentCount: records.filter((r) => r.status === 'absent').length,
        clCount: records.filter((r) => r.status === 'cl').length,
        notMarkedCount: records.filter((r) => r.status === 'not_marked').length,
      };

      return {
        success: true,
        type: 'Daily Attendance Report',
        date,
        statistics: stats,
        records: records.map((r) => ({
          teacherId: r.teacherId,
          status: r.status,
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          isLate: r.isLate,
          lateMinutes: r.lateMinutes,
          source: r.source,
          gpsVerified: r.gpsVerified,
        })),
      };
    } catch (error) {
      console.error('Error generating daily attendance report:', error);
      throw error;
    }
  }

  /**
   * Generate Monthly Attendance Report
   */
  async generateMonthlyAttendanceReport(month: string) {
    try {
      const q = query(
        collection(this.db, 'attendance_summary'),
        where('month', '==', month),
        orderBy('teacherId')
      );

      const snap = await getDocs(q);
      const summaries = snap.docs.map((doc) => doc.data());

      const aggregatedStats = {
        month,
        totalTeachers: summaries.length,
        totalPresentDays: summaries.reduce((sum, s) => sum + (s.presentDays || 0), 0),
        totalLateDays: summaries.reduce((sum, s) => sum + (s.lateDays || 0), 0),
        totalAbsentDays: summaries.reduce((sum, s) => sum + (s.absentDays || 0), 0),
        totalNotMarked: summaries.reduce((sum, s) => sum + (s.notMarkedDays || 0), 0),
      };

      return {
        success: true,
        type: 'Monthly Attendance Report',
        month,
        statistics: aggregatedStats,
        teacherDetails: summaries.map((s) => ({
          teacherId: s.teacherId,
          presentDays: s.presentDays,
          lateDays: s.lateDays,
          absentDays: s.absentDays,
          totalWorkingDays: s.totalWorkingDays,
          attendancePercentage:
            ((s.presentDays / s.totalWorkingDays) * 100).toFixed(2) + '%',
        })),
      };
    } catch (error) {
      console.error('Error generating monthly attendance report:', error);
      throw error;
    }
  }

  /**
   * Generate Late Attendance Report
   */
  async generateLateAttendanceReport(month?: string) {
    try {
      let q;

      if (month) {
        q = query(
          collection(this.db, 'attendance'),
          where('status', '==', 'late'),
          where('month', '==', month),
          orderBy('date', 'desc')
        );
      } else {
        q = query(
          collection(this.db, 'attendance'),
          where('status', '==', 'late'),
          orderBy('date', 'desc')
        );
      }

      const snap = await getDocs(q);
      const records = snap.docs.map((doc) => doc.data());

      // Group by teacher
      const byTeacher: { [key: string]: any[] } = {};
      for (const record of records) {
        if (!byTeacher[record.teacherId]) {
          byTeacher[record.teacherId] = [];
        }
        byTeacher[record.teacherId].push(record);
      }

      return {
        success: true,
        type: 'Late Attendance Report',
        period: month || 'All Time',
        totalLateEntries: records.length,
        teacherSummary: Object.entries(byTeacher).map(([teacherId, entries]) => ({
          teacherId,
          lateDaysCount: entries.length,
          averageLateMinutes: (
            entries.reduce((sum, e) => sum + (e.lateMinutes || 0), 0) /
            entries.length
          ).toFixed(1),
          details: entries.map((e) => ({
            date: e.date,
            checkInTime: e.checkInTime,
            lateMinutes: e.lateMinutes,
          })),
        })),
      };
    } catch (error) {
      console.error('Error generating late attendance report:', error);
      throw error;
    }
  }

  /**
   * Generate Leave Deduction Report
   */
  async generateLeaveDeductionReport(month: string) {
    try {
      const q = query(
        collection(this.db, 'casual_leave_transactions'),
        where('month', '==', month),
        orderBy('date', 'desc')
      );

      const snap = await getDocs(q);
      const transactions = snap.docs.map((doc) => doc.data());

      // Group by teacher
      const byTeacher: { [key: string]: any } = {};
      for (const trans of transactions) {
        if (!byTeacher[trans.teacherId]) {
          byTeacher[trans.teacherId] = {
            teacherId: trans.teacherId,
            deductionsFromAbsent: 0,
            deductionsFromLates: 0,
            totalDeductions: 0,
            transactions: [],
          };
        }

        if (trans.reason === 'absent') {
          byTeacher[trans.teacherId].deductionsFromAbsent += trans.casualLeavesDeducted;
        } else if (trans.reason === 'excessive_lates') {
          byTeacher[trans.teacherId].deductionsFromLates += trans.casualLeavesDeducted;
        }

        byTeacher[trans.teacherId].totalDeductions += trans.casualLeavesDeducted;
        byTeacher[trans.teacherId].transactions.push({
          date: trans.date,
          reason: trans.reason,
          deducted: trans.casualLeavesDeducted,
          balanceBefore: trans.balanceBefore,
          balanceAfter: trans.balanceAfter,
        });
      }

      return {
        success: true,
        type: 'Leave Deduction Report',
        month,
        totalTransactions: transactions.length,
        teacherSummary: Object.values(byTeacher),
      };
    } catch (error) {
      console.error('Error generating leave deduction report:', error);
      throw error;
    }
  }

  /**
   * Generate Salary Report
   */
  async generateSalaryReportForMonth(month: string) {
    try {
      const q = query(
        collection(this.db, 'salary_reports'),
        where('month', '==', month),
        orderBy('teacherName')
      );

      const snap = await getDocs(q);
      const reports = snap.docs.map((doc) => doc.data());

      const aggregatedStats = {
        month,
        totalTeachers: reports.length,
        totalBaseSalary: reports.reduce((sum, r) => sum + (r.baseSalary || 0), 0),
        totalDeductions: reports.reduce((sum, r) => sum + (r.totalDeduction || 0), 0),
        totalNetSalary: reports.reduce((sum, r) => sum + (r.netSalary || 0), 0),
        averageNetSalary: 0,
      };

      aggregatedStats.averageNetSalary =
        reports.length > 0
          ? aggregatedStats.totalNetSalary / reports.length
          : 0;

      return {
        success: true,
        type: 'Monthly Salary Report',
        month,
        statistics: aggregatedStats,
        teacherDetails: reports.map((r) => ({
          teacherId: r.teacherId,
          teacherName: r.teacherName,
          employeeId: r.employeeId,
          baseSalary: r.baseSalary,
          presentDays: r.presentDays,
          lateDays: r.lateDays,
          absentDays: r.absentDays,
          deductionFromAbsent: r.deductionFromAbsent,
          deductionFromLates: r.deductionFromLates,
          totalDeduction: r.totalDeduction,
          netSalary: r.netSalary,
          status: r.status,
          isPaid: r.isPaid,
        })),
      };
    } catch (error) {
      console.error('Error generating salary report:', error);
      throw error;
    }
  }

  /**
   * Generate Dashboard Statistics
   */
  async generateDashboardStats(month?: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = month || new Date().toISOString().slice(0, 7);

      // 1. Today's attendance
      const todayQ = query(
        collection(this.db, 'attendance'),
        where('date', '==', today)
      );
      const todaySnap = await getDocs(todayQ);
      const todayRecords = todaySnap.docs.map((doc) => doc.data());

      const todayStats = {
        date: today,
        totalMarked: todayRecords.length,
        present: todayRecords.filter((r) => r.status === 'present').length,
        late: todayRecords.filter((r) => r.status === 'late').length,
        absent: todayRecords.filter((r) => r.status === 'absent').length,
        notMarked: 0, // Will calculate from total teachers
      };

      // 2. Monthly statistics
      const monthlyQ = query(
        collection(this.db, 'attendance_summary'),
        where('month', '==', currentMonth)
      );
      const monthlySnap = await getDocs(monthlyQ);
      const monthlySummaries = monthlySnap.docs.map((doc) => doc.data());

      const monthlyStats = {
        month: currentMonth,
        totalTeachers: monthlySummaries.length,
        averageAttendance: 0,
        highestLateCount: 0,
        averageLateCount: 0,
      };

      if (monthlySummaries.length > 0) {
        const totalAttendance = monthlySummaries.reduce(
          (sum, s) => sum + ((s.presentDays || 0) / (s.totalWorkingDays || 1)),
          0
        );
        monthlyStats.averageAttendance =
          (totalAttendance / monthlySummaries.length * 100).toFixed(2);

        const lateCounts = monthlySummaries.map((s) => s.lateEntriesCount || 0);
        monthlyStats.highestLateCount = Math.max(...lateCounts);
        monthlyStats.averageLateCount = (
          lateCounts.reduce((a, b) => a + b, 0) / lateCounts.length
        ).toFixed(2);
      }

      // 3. Teacher count
      const teachersQ = query(
        collection(this.db, 'teachers'),
        where('status', '==', 'active')
      );
      const teachersSnap = await getDocs(teachersQ);
      todayStats.notMarked = teachersSnap.docs.length - todayStats.totalMarked;

      // 4. CL balance overview
      const allTeachersQ = query(
        collection(this.db, 'teachers'),
        where('status', '==', 'active')
      );
      const allTeachersSnap = await getDocs(allTeachersQ);
      const clStats = {
        averageBalance: 0,
        criticalCount: 0, // Balance <= 0
        warningCount: 0, // Balance <= 2
      };

      const balances = allTeachersSnap.docs.map(
        (doc) => doc.data().casualLeaveBalance || 0
      );
      if (balances.length > 0) {
        clStats.averageBalance = (
          balances.reduce((a, b) => a + b, 0) / balances.length
        ).toFixed(2);
        clStats.criticalCount = balances.filter((b) => b <= 0).length;
        clStats.warningCount = balances.filter((b) => b > 0 && b <= 2).length;
      }

      return {
        success: true,
        type: 'Dashboard Statistics',
        today: todayStats,
        monthly: monthlyStats,
        casualLeave: clStats,
        totalTeachers: allTeachersSnap.docs.length,
      };
    } catch (error) {
      console.error('Error generating dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Generate teacher-specific attendance report
   */
  async generateTeacherAttendanceReport(
    teacherId: string,
    month?: string
  ) {
    try {
      // Get teacher info
      const teacherRef = doc(this.db, 'teachers', teacherId);
      const teacherSnap = await getDoc(teacherRef);

      if (!teacherSnap.exists()) {
        throw new Error('Teacher not found');
      }

      const teacher = teacherSnap.data();

      // Get attendance records
      let q;
      if (month) {
        q = query(
          collection(this.db, 'attendance'),
          where('teacherId', '==', teacherId),
          where('month', '==', month),
          orderBy('date', 'desc')
        );
      } else {
        q = query(
          collection(this.db, 'attendance'),
          where('teacherId', '==', teacherId),
          orderBy('date', 'desc')
        );
      }

      const snap = await getDocs(q);
      const records = snap.docs.map((doc) => doc.data());

      // Calculate statistics
      const stats = {
        totalRecords: records.length,
        presentCount: records.filter((r) => r.status === 'present').length,
        lateCount: records.filter((r) => r.status === 'late').length,
        absentCount: records.filter((r) => r.status === 'absent').length,
        clCount: records.filter((r) => r.status === 'cl').length,
        averageLateMinutes: 0,
      };

      const lateRecords = records.filter((r) => r.status === 'late');
      if (lateRecords.length > 0) {
        stats.averageLateMinutes = (
          lateRecords.reduce((sum, r) => sum + (r.lateMinutes || 0), 0) /
          lateRecords.length
        ).toFixed(1);
      }

      return {
        success: true,
        type: 'Teacher Attendance Report',
        teacher: {
          teacherId: teacher.teacherId,
          name: teacher.fullName,
          employeeId: teacher.employeeId,
        },
        period: month || 'All Time',
        statistics: stats,
        detailedRecords: records.map((r) => ({
          date: r.date,
          status: r.status,
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          lateMinutes: r.lateMinutes,
          source: r.source,
        })),
      };
    } catch (error) {
      console.error('Error generating teacher attendance report:', error);
      throw error;
    }
  }

  /**
   * Export report to CSV
   */
  async exportReportToCSV(report: any): Promise<string> {
    try {
      let csv = `${report.type}\n`;

      if (report.statistics) {
        csv += '\nSUMMARY\n';
        Object.entries(report.statistics).forEach(([key, value]) => {
          csv += `${key},${value}\n`;
        });
      }

      if (report.records && Array.isArray(report.records)) {
        csv += '\nDETAILS\n';
        const headers = Object.keys(report.records[0]);
        csv += headers.join(',') + '\n';

        report.records.forEach((record: any) => {
          csv +=
            headers
              .map((h) => {
                const val = record[h];
                if (typeof val === 'object') {
                  return JSON.stringify(val);
                }
                return val;
              })
              .join(',') + '\n';
        });
      }

      return csv;
    } catch (error) {
      console.error('Error exporting report to CSV:', error);
      throw error;
    }
  }

  /**
   * Export report to PDF (returns JSON for frontend to handle PDF generation)
   */
  async prepareReportForPDF(report: any): Promise<any> {
    return {
      success: true,
      report,
      generatedAt: new Date().toISOString(),
    };
  }
}

export default new ReportService();
