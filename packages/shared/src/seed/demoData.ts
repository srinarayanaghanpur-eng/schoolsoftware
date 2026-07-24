import { DEFAULT_SETTINGS } from "../constants";
import type {
  AttendanceEditAudit,
  AttendanceRecord,
  BiometricLog,
  Holiday,
  LeaveRequest,
  PasswordResetHistory,
  PasswordResetRequest,
  Teacher
} from "../types/models";

export const demoTeachers: Teacher[] = [
  {
    id: "teacher_anita",
    uid: "demo_uid_anita",
    fullName: "Anita Sharma",
    internalEmail: "emp001@srinarayana.local",
    phone: "9876543210",
    subject: "Mathematics",
    employeeId: "EMP001",
    employeeIdLower: "emp001",
    biometricUserId: "EMP001",
    baseSalary: 52000,
    joiningDate: "2021-06-01",
    status: "active",
    role: "teacher",
    allowedCLPerMonth: 3,
    lateDeductionRule: "after_3_lates_one_day",
    gpsEnabled: true,
    gpsLatitude: DEFAULT_SETTINGS.campusLatitude,
    gpsLongitude: DEFAULT_SETTINGS.campusLongitude,
    gpsRadiusMeters: DEFAULT_SETTINGS.geofenceRadiusMeters,
    casualLeaveBalance: 12,
    casualLeaveUsedThisMonth: 0,
    lateEntriesThisMonth: 0,
    absentDaysThisMonth: 0,
    createdAt: "2026-05-01T03:30:00.000Z",
    updatedAt: "2026-05-01T03:30:00.000Z"
  },
  {
    id: "teacher_ravi",
    uid: "demo_uid_ravi",
    fullName: "Ravi Kumar",
    internalEmail: "emp002@srinarayana.local",
    phone: "9876501234",
    subject: "Science",
    employeeId: "EMP002",
    employeeIdLower: "emp002",
    biometricUserId: "EMP002",
    baseSalary: 48000,
    joiningDate: "2022-04-15",
    status: "active",
    role: "teacher",
    allowedCLPerMonth: 3,
    lateDeductionRule: "fixed",
    gpsEnabled: true,
    gpsLatitude: DEFAULT_SETTINGS.campusLatitude,
    gpsLongitude: DEFAULT_SETTINGS.campusLongitude,
    gpsRadiusMeters: DEFAULT_SETTINGS.geofenceRadiusMeters,
    casualLeaveBalance: 10,
    casualLeaveUsedThisMonth: 1,
    lateEntriesThisMonth: 2,
    absentDaysThisMonth: 0,
    createdAt: "2026-05-01T03:30:00.000Z",
    updatedAt: "2026-05-01T03:30:00.000Z"
  },
  {
    id: "teacher_meera",
    uid: "demo_uid_meera",
    fullName: "Meera Nair",
    internalEmail: "emp003@srinarayana.local",
    phone: "9876512345",
    subject: "English",
    employeeId: "EMP003",
    employeeIdLower: "emp003",
    biometricUserId: "EMP003",
    baseSalary: 50000,
    joiningDate: "2020-07-10",
    status: "active",
    role: "teacher",
    allowedCLPerMonth: 3,
    lateDeductionRule: "half_day",
    gpsEnabled: true,
    gpsLatitude: DEFAULT_SETTINGS.campusLatitude,
    gpsLongitude: DEFAULT_SETTINGS.campusLongitude,
    gpsRadiusMeters: DEFAULT_SETTINGS.geofenceRadiusMeters,
    casualLeaveBalance: 14,
    casualLeaveUsedThisMonth: 0,
    lateEntriesThisMonth: 0,
    absentDaysThisMonth: 0,
    createdAt: "2026-05-01T03:30:00.000Z",
    updatedAt: "2026-05-01T03:30:00.000Z"
  }
];

export const demoAttendance: AttendanceRecord[] = [
  {
    teacherId: "teacher_anita",
    date: "2026-05-19",
    month: "2026-05",
    year: 2026,
    status: "present",
    checkInTime: "2026-05-19T03:22:00.000Z",
    checkOutTime: "2026-05-19T10:35:00.000Z",
    source: "mobile",
    sourcesUsed: ["mobile", "biometric"],
    latitude: DEFAULT_SETTINGS.campusLatitude,
    longitude: DEFAULT_SETTINGS.campusLongitude,
    distanceFromCampus: 24,
    deviceInfo: "iPhone 14",
    biometricDeviceId: "ESSL-001",
    lateMinutes: 0,
    isLate: false,
    adminEdited: false,
    createdAt: "2026-05-19T03:22:00.000Z",
    updatedAt: "2026-05-19T10:35:00.000Z"
  },
  {
    teacherId: "teacher_ravi",
    date: "2026-05-19",
    month: "2026-05",
    year: 2026,
    status: "late",
    checkInTime: "2026-05-19T03:47:00.000Z",
    source: "biometric",
    sourcesUsed: ["biometric"],
    biometricDeviceId: "ESSL-001",
    lateMinutes: 17,
    isLate: true,
    adminEdited: false,
    createdAt: "2026-05-19T03:47:00.000Z",
    updatedAt: "2026-05-19T03:47:00.000Z"
  },
  {
    teacherId: "teacher_meera",
    date: "2026-05-19",
    month: "2026-05",
    year: 2026,
    status: "cl",
    source: "admin",
    sourcesUsed: ["admin"],
    lateMinutes: 0,
    isLate: false,
    remarks: "Approved casual leave",
    adminEdited: true,
    editedBy: "admin_demo",
    editReason: "Leave approved by principal",
    createdAt: "2026-05-19T02:30:00.000Z",
    updatedAt: "2026-05-19T02:30:00.000Z"
  }
];

export const demoHolidays: Holiday[] = [
  {
    id: "holiday_2026_05_01",
    date: "2026-05-01",
    title: "May Day",
    type: "public",
    createdAt: "2026-04-01T03:30:00.000Z"
  }
];

export const demoBiometricLogs: BiometricLog[] = [
  {
    id: "bio_001",
    deviceId: "ESSL-001",
    biometricUserId: "EMP001",
    teacherId: "teacher_anita",
    timestamp: "2026-05-19T03:22:15.000Z",
    verificationType: "face",
    eventType: "checkin",
    rawPayload: {},
    processed: true,
    createdAt: "2026-05-19T03:22:15.000Z"
  },
  {
    id: "bio_002",
    deviceId: "ESSL-001",
    biometricUserId: "EMP002",
    teacherId: "teacher_ravi",
    timestamp: "2026-05-19T03:47:00.000Z",
    verificationType: "fingerprint",
    eventType: "checkin",
    rawPayload: {},
    processed: true,
    createdAt: "2026-05-19T03:47:00.000Z"
  }
];

export const demoPasswordResetRequests: PasswordResetRequest[] = [
  {
    id: "reset_req_emp002",
    loginId: "EMP002",
    employeeId: "EMP002",
    teacherId: "teacher_ravi",
    teacherName: "Ravi Kumar",
    status: "open",
    requestedAt: "2026-05-20T04:20:00.000Z"
  }
];

export const demoPasswordResetHistory: PasswordResetHistory[] = [
  {
    id: "reset_history_emp003",
    teacherId: "teacher_meera",
    teacherName: "Meera Nair",
    employeeId: "EMP003",
    resetBy: "admin_demo",
    resetAt: "2026-05-18T06:15:00.000Z",
    note: "Initial demo reset"
  }
];

export const demoLeaveRequests: LeaveRequest[] = [
  {
    id: "leave_req_emp003",
    teacherId: "teacher_meera",
    teacherName: "Meera Nair",
    employeeId: "EMP003",
    startDate: "2026-05-19",
    endDate: "2026-05-19",
    reason: "Personal leave",
    status: "approved",
    requestedAt: "2026-05-18T05:30:00.000Z",
    reviewedAt: "2026-05-18T06:00:00.000Z",
    reviewedBy: "admin_demo",
    adminNote: "Approved casual leave",
    attendanceUpdated: true
  }
];

export const demoAttendanceEditAudits: AttendanceEditAudit[] = [
  {
    id: "attendance_audit_meera_2026_05_19",
    attendanceId: "teacher_meera_2026-05-19",
    teacherId: "teacher_meera",
    date: "2026-05-19",
    previousStatus: "not_marked",
    newStatus: "cl",
    reason: "Leave approved by principal",
    editedBy: "admin_demo",
    editedAt: "2026-05-19T02:30:00.000Z"
  }
];
