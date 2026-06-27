/**
 * Enhanced Attendance Service
 * Integrates business logic with Firestore operations
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
} from '@firebase/firestore';
import {
  AttendanceLogic,
  LateAndLeaveLogic,
  SalaryLogic,
  ValidationLogic,
} from './businessLogic';

export class EnhancedAttendanceService {
  private db = getFirestore();

  /**
   * Mark attendance with complete business logic
   * 1. Validate input
   * 2. Check GPS and geofence
   * 3. Determine if late
   * 4. Update CL balance if needed
   * 5. Record attendance
   * 6. Update monthly summary
   */
  async markAttendance(
    teacherId: string,
    checkInTime: Date,
    checkOutTime?: Date,
    latitude?: number,
    longitude?: number,
    source: 'mobile' | 'biometric' = 'mobile',
    schoolSettings?: {
      schoolStartTime: string;
      graceMinutesForLate: number;
      campusLatitude: number;
      campusLongitude: number;
      geofenceRadiusMeters: number;
      latesBeforeCLDeduction: number;
    }
  ) {
    try {
      // 1. Get school settings
      const settings = schoolSettings || (await this.getSchoolSettings());

      // 2. Validate input
      if (!ValidationLogic.isValidCoordinates(latitude || 0, longitude || 0)) {
        throw new Error('Invalid GPS coordinates');
      }

      // 3. Determine late status
      const { isLate, lateMinutes } = AttendanceLogic.determineIsLate(
        checkInTime,
        settings.schoolStartTime,
        settings.graceMinutesForLate
      );

      // 4. Check GPS verification
      let gpsVerified = true;
      let distanceFromCampus = 0;

      if (latitude && longitude) {
        distanceFromCampus = AttendanceLogic.calculateDistance(
          latitude,
          longitude,
          settings.campusLatitude,
          settings.campusLongitude
        );

        gpsVerified = AttendanceLogic.isWithinGeofence(
          latitude,
          longitude,
          settings.campusLatitude,
          settings.campusLongitude,
          settings.geofenceRadiusMeters
        );
      }

      // 5. Get date info
      const date = checkInTime.toISOString().split('T')[0];
      const [year, month] = date.split('-').slice(0, 2).map(Number);
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`;

      // 6. Determine attendance status
      let status = 'present';
      if (isLate) status = 'late';

      // 7. Check for duplicate attendance
      const existingAttendance = await this.getAttendanceRecord(teacherId, date);
      if (existingAttendance) {
        throw new Error('Attendance already marked for this day');
      }

      // 8. Use transaction to ensure consistency
      const result = await runTransaction(this.db, async (transaction) => {
        // Get teacher data
        const teacherRef = doc(this.db, 'teachers', teacherId);
        const teacherSnap = await transaction.get(teacherRef);

        if (!teacherSnap.exists()) {
          throw new Error('Teacher not found');
        }

        const teacherData = teacherSnap.data();
        let casualLeaveDeduction = 0;
        let newLateEntriesCount = teacherData.lateEntriesCount || 0;

        // Calculate CL deduction if late
        if (isLate) {
          const { casualLeavesToDeduct, newLateCount } =
            LateAndLeaveLogic.calculateCLDeductionFromLates(
              newLateEntriesCount,
              true,
              {
                latesBeforeCLDeduction: settings.latesBeforeCLDeduction,
                schoolStartTime: settings.schoolStartTime,
                graceMinutesForLate: settings.graceMinutesForLate,
                defaultLateDeductionMode: 'after_3_lates_one_day',
                fixedLateDeductionAmount: 0,
                totalWorkingDaysPerMonth: 0,
                casualLeaveAllowancePerMonth: 0,
              }
            );

          casualLeaveDeduction = casualLeavesToDeduct;
          newLateEntriesCount = newLateCount;
        }

        // Update teacher record
        const updatedTeacherData: any = {
          lateDaysThisMonth: teacherData.lateDaysThisMonth || 0,
          lateEntriesCount: newLateEntriesCount,
          casualLeaveBalance: Math.max(
            0,
            (teacherData.casualLeaveBalance || 0) - casualLeaveDeduction
          ),
          updatedAt: Timestamp.now(),
        };

        if (isLate) {
          updatedTeacherData.lateDaysThisMonth =
            (teacherData.lateDaysThisMonth || 0) + 1;
        } else {
          updatedTeacherData.presentDaysThisMonth =
            (teacherData.presentDaysThisMonth || 0) + 1;
        }

        transaction.update(teacherRef, updatedTeacherData);

        // Create attendance record
        const attendanceId = `${teacherId}_${date}`;
        const attendanceRef = doc(this.db, 'attendance', attendanceId);
        const workingHours = checkOutTime
          ? AttendanceLogic.calculateWorkingHours(checkInTime, checkOutTime)
          : 0;

        transaction.set(attendanceRef, {
          teacherId,
          date,
          month: monthStr,
          year,
          status,
          checkInTime: Timestamp.fromDate(checkInTime),
          checkOutTime: checkOutTime ? Timestamp.fromDate(checkOutTime) : null,
          workingHours,
          isLate,
          lateMinutes: isLate ? lateMinutes : 0,
          source,
          sourcesUsed: [source],
          gpsVerified,
          checkInLatitude: latitude || null,
          checkInLongitude: longitude || null,
          distanceFromCampusMeters: distanceFromCampus || null,
          adminEdited: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // Log CL deduction if applicable
        if (casualLeaveDeduction > 0) {
          const transactionId = `${teacherId}_${date}_CL`;
          const transactionRef = doc(
            this.db,
            'casual_leave_transactions',
            transactionId
          );

          transaction.set(transactionRef, {
            transactionId,
            teacherId,
            month: monthStr,
            date,
            type: 'deduction',
            reason: 'excessive_lates',
            lateEntriesCount: newLateEntriesCount,
            casualLeavesDeducted: casualLeaveDeduction,
            attendanceId,
            balanceBefore: teacherData.casualLeaveBalance || 0,
            balanceAfter: Math.max(
              0,
              (teacherData.casualLeaveBalance || 0) - casualLeaveDeduction
            ),
            createdAt: Timestamp.now(),
          });
        }

        // Update monthly summary
        const summaryId = `${teacherId}_${monthStr}`;
        const summaryRef = doc(this.db, 'attendance_summary', summaryId);
        const summarySnap = await transaction.get(summaryRef);

        const summaryData = summarySnap.exists()
          ? summarySnap.data()
          : {
              teacherId,
              month: monthStr,
              year,
              totalWorkingDays: 22, // Default
              presentDays: 0,
              lateDays: 0,
              absentDays: 0,
              lateEntriesCount: 0,
              casualLeavesDeductedFromLates: 0,
              casualLeavesDeductedFromAbsent: 0,
            };

        const updatedSummary: any = {
          ...summaryData,
          updatedAt: Timestamp.now(),
        };

        if (isLate) {
          updatedSummary.lateDays = (summaryData.lateDays || 0) + 1;
          updatedSummary.lateEntriesCount = newLateEntriesCount;
          updatedSummary.casualLeavesDeductedFromLates = Math.floor(
            newLateEntriesCount / settings.latesBeforeCLDeduction
          );
        } else {
          updatedSummary.presentDays = (summaryData.presentDays || 0) + 1;
        }

        transaction.set(summaryRef, updatedSummary, { merge: true });

        return {
          success: true,
          attendanceId,
          status,
          isLate,
          lateMinutes: isLate ? lateMinutes : 0,
          gpsVerified,
          casualLeaveDeducted: casualLeaveDeduction,
          newCLBalance: Math.max(
            0,
            (teacherData.casualLeaveBalance || 0) - casualLeaveDeduction
          ),
        };
      });

      return result;
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  }

  /**
   * Mark attendance as absent for a teacher
   * Automatically deducts 1 CL
   */
  async markAbsent(
    teacherId: string,
    date: string,
    reason?: string
  ) {
    try {
      if (!ValidationLogic.isValidDateFormat(date)) {
        throw new Error('Invalid date format');
      }

      const [year, month] = date.split('-').slice(0, 2).map(Number);
      const monthStr = `${year}-${month.toString().padStart(2, '0')}`;

      return await runTransaction(this.db, async (transaction) => {
        // Get teacher data
        const teacherRef = doc(this.db, 'teachers', teacherId);
        const teacherSnap = await transaction.get(teacherRef);

        if (!teacherSnap.exists()) {
          throw new Error('Teacher not found');
        }

        const teacherData = teacherSnap.data();

        // Deduct 1 CL for absence
        const clDeduction = 1;
        const newBalance = Math.max(
          0,
          (teacherData.casualLeaveBalance || 0) - clDeduction
        );

        // Update teacher
        transaction.update(teacherRef, {
          absentDaysThisMonth: (teacherData.absentDaysThisMonth || 0) + 1,
          casualLeaveBalance: newBalance,
          casualLeaveDeductedThisMonth:
            (teacherData.casualLeaveDeductedThisMonth || 0) + clDeduction,
          updatedAt: Timestamp.now(),
        });

        // Create attendance record
        const attendanceId = `${teacherId}_${date}`;
        const attendanceRef = doc(this.db, 'attendance', attendanceId);

        transaction.set(attendanceRef, {
          teacherId,
          date,
          month: monthStr,
          year,
          status: 'absent',
          isLate: false,
          gpsVerified: false,
          source: 'admin',
          sourcesUsed: [],
          adminEdited: false,
          reason,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });

        // Log CL deduction
        const transactionId = `${teacherId}_${date}_ABSENT`;
        const clTransactionRef = doc(
          this.db,
          'casual_leave_transactions',
          transactionId
        );

        transaction.set(clTransactionRef, {
          transactionId,
          teacherId,
          month: monthStr,
          date,
          type: 'deduction',
          reason: 'absent',
          casualLeavesDeducted: clDeduction,
          attendanceId,
          balanceBefore: teacherData.casualLeaveBalance || 0,
          balanceAfter: newBalance,
          createdAt: Timestamp.now(),
        });

        // Update monthly summary
        const summaryId = `${teacherId}_${monthStr}`;
        const summaryRef = doc(this.db, 'attendance_summary', summaryId);
        const summarySnap = await transaction.get(summaryRef);

        const summaryData = summarySnap.exists()
          ? summarySnap.data()
          : {
              teacherId,
              month: monthStr,
              year,
              totalWorkingDays: 22,
              presentDays: 0,
              absentDays: 0,
              casualLeavesDeductedFromAbsent: 0,
            };

        transaction.set(
          summaryRef,
          {
            ...summaryData,
            absentDays: (summaryData.absentDays || 0) + 1,
            casualLeavesDeductedFromAbsent:
              (summaryData.casualLeavesDeductedFromAbsent || 0) + clDeduction,
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );

        return {
          success: true,
          attendanceId,
          status: 'absent',
          clDeducted: clDeduction,
          newCLBalance: newBalance,
        };
      });
    } catch (error) {
      console.error('Error marking absent:', error);
      throw error;
    }
  }

  /**
   * Get attendance record for a specific date
   */
  async getAttendanceRecord(teacherId: string, date: string) {
    try {
      const attendanceId = `${teacherId}_${date}`;
      const ref = doc(this.db, 'attendance', attendanceId);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error getting attendance record:', error);
      return null;
    }
  }

  /**
   * Get monthly attendance summary
   */
  async getMonthlyAttendanceSummary(teacherId: string, month: string) {
    try {
      const summaryId = `${teacherId}_${month}`;
      const ref = doc(this.db, 'attendance_summary', summaryId);
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      console.error('Error getting monthly summary:', error);
      return null;
    }
  }

  /**
   * Get teacher's attendance records for a month
   */
  async getMonthlyAttendanceRecords(teacherId: string, month: string) {
    try {
      const q = query(
        collection(this.db, 'attendance'),
        where('teacherId', '==', teacherId),
        where('month', '==', month),
        orderBy('date', 'desc')
      );

      const snap = await getDocs(q);
      return snap.docs.map((doc) => doc.data());
    } catch (error) {
      console.error('Error getting monthly attendance records:', error);
      return [];
    }
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

      return snap.data() as any;
    } catch (error) {
      console.error('Error getting school settings:', error);
      // Return default settings
      return {
        schoolStartTime: '09:00',
        graceMinutesForLate: 10,
        campusLatitude: 18.306,
        campusLongitude: 79.883,
        geofenceRadiusMeters: 150,
        latesBeforeCLDeduction: 3,
        defaultLateDeductionMode: 'after_3_lates_one_day',
      };
    }
  }

  /**
   * Update attendance record (admin action)
   */
  async updateAttendanceRecord(
    teacherId: string,
    date: string,
    newStatus: string,
    reason: string,
    adminId: string
  ) {
    try {
      if (!ValidationLogic.isValidDateFormat(date)) {
        throw new Error('Invalid date format');
      }

      if (!ValidationLogic.isValidAttendanceStatus(newStatus as any)) {
        throw new Error('Invalid attendance status');
      }

      const attendanceId = `${teacherId}_${date}`;
      const ref = doc(this.db, 'attendance', attendanceId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        throw new Error('Attendance record not found');
      }

      const oldData = snap.data();

      await updateDoc(ref, {
        status: newStatus,
        adminEdited: true,
        editedBy: adminId,
        editReason: reason,
        originalStatus: oldData.status,
        editedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });

      // Log audit entry
      const [year, month] = date.split('-').slice(0, 2).map(Number);
      const auditId = `${teacherId}_${date}_${Timestamp.now().toMillis()}`;
      const auditRef = doc(
        this.db,
        'attendance_edit_audit_logs',
        auditId
      );

      await setDoc(auditRef, {
        auditId,
        teacherId,
        attendanceId,
        date,
        adminId,
        adminName: 'Admin', // Should fetch admin name
        originalStatus: oldData.status,
        newStatus,
        editReason: reason,
        editedAt: Timestamp.now(),
      });

      return {
        success: true,
        oldStatus: oldData.status,
        newStatus,
      };
    } catch (error) {
      console.error('Error updating attendance record:', error);
      throw error;
    }
  }

  /**
   * Get CL transaction history
   */
  async getCLTransactionHistory(teacherId: string, month?: string) {
    try {
      let q;
      if (month) {
        q = query(
          collection(this.db, 'casual_leave_transactions'),
          where('teacherId', '==', teacherId),
          where('month', '==', month),
          orderBy('date', 'desc')
        );
      } else {
        q = query(
          collection(this.db, 'casual_leave_transactions'),
          where('teacherId', '==', teacherId),
          orderBy('date', 'desc')
        );
      }

      const snap = await getDocs(q);
      return snap.docs.map((doc) => doc.data());
    } catch (error) {
      console.error('Error getting CL transaction history:', error);
      return [];
    }
  }
}

export default new EnhancedAttendanceService();
