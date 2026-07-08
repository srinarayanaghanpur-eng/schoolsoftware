import { ATTENDANCE_WINDOWS, DEFAULT_SETTINGS } from "../constants";
import type {
  AttendanceEventType,
  AttendanceRecord,
  AttendanceSource,
  AttendanceStatus,
  EmploymentType,
  GpsPoint,
  SchoolSettings
} from "../types/models";
import { getTimePartsInZone, minutesFromClock, nowIso, toDateKey, toMonthKey, getYear } from "../utils/date";

export type AttendanceEventInput = {
  teacherId: string;
  timestamp: string;
  source: AttendanceSource;
  eventType: AttendanceEventType;
  gps?: GpsPoint;
  distanceFromCampus?: number;
  deviceInfo?: string;
  biometricDeviceId?: string;
  remarks?: string;
  rawData?: unknown;
};

export const FULL_DAY_HOURS = 6;
export const HALF_DAY_HOURS = 3;

export function createAttendanceDocumentId(teacherId: string, date: string) {
  return `${teacherId}_${date}`;
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * radius * Math.asin(Math.sqrt(a)));
}

export function getDistanceFromCampus(current: GpsPoint, settings: SchoolSettings = DEFAULT_SETTINGS) {
  return calculateDistanceMeters(
    current.latitude,
    current.longitude,
    settings.campusLatitude,
    settings.campusLongitude
  );
}

export function isInsideCampus(current: GpsPoint, settings: SchoolSettings = DEFAULT_SETTINGS) {
  return getDistanceFromCampus(current, settings) <= settings.geofenceRadiusMeters;
}

export function getAttendanceWindow(employmentType: EmploymentType = "full_time") {
  return ATTENDANCE_WINDOWS[employmentType] ?? ATTENDANCE_WINDOWS.full_time;
}

function minutesInZone(timestamp: string | Date, settings: SchoolSettings) {
  const time = getTimePartsInZone(timestamp, settings.timezone);
  return time.hour * 60 + time.minute;
}

/** True if the check-in timestamp falls inside this employment type's check-in window. */
export function isWithinCheckInWindow(
  timestamp: string | Date,
  settings: SchoolSettings = DEFAULT_SETTINGS,
  employmentType: EmploymentType = "full_time"
) {
  const window = getAttendanceWindow(employmentType);
  const now = minutesInZone(timestamp, settings);
  return now >= minutesFromClock(window.checkInStart) && now <= minutesFromClock(window.checkInEnd);
}

/** True if the check-out timestamp falls inside this employment type's check-out window. */
export function isWithinCheckOutWindow(
  timestamp: string | Date,
  settings: SchoolSettings = DEFAULT_SETTINGS,
  employmentType: EmploymentType = "full_time"
) {
  const window = getAttendanceWindow(employmentType);
  const now = minutesInZone(timestamp, settings);
  return now >= minutesFromClock(window.checkOutStart) && now <= minutesFromClock(window.checkOutEnd);
}

export function getAttendanceStatus(
  checkInTime: string,
  settings: SchoolSettings = DEFAULT_SETTINGS,
  employmentType: EmploymentType = "full_time"
) {
  const window = getAttendanceWindow(employmentType);
  const checkInMinutes = minutesInZone(checkInTime, settings);
  const allowedMinutes = minutesFromClock(window.lateAfter);
  const lateMinutes = Math.max(0, checkInMinutes - allowedMinutes);
  return {
    status: lateMinutes > 0 ? "late" : "present",
    isLate: lateMinutes > 0,
    lateMinutes
  } as const;
}

/** Calculate working hours (in decimal) between check-in and check-out times. */
export function calculateWorkingHours(checkInTime: string | undefined, checkOutTime: string | undefined): number {
  if (!checkInTime || !checkOutTime) return 0;
  const checkIn = new Date(checkInTime).getTime();
  const checkOut = new Date(checkOutTime).getTime();
  if (Number.isNaN(checkIn) || Number.isNaN(checkOut) || checkOut <= checkIn) return 0;
  return (checkOut - checkIn) / (1000 * 60 * 60);
}

/** Determine final attendance status based on check-in, check-out, and working hours. */
export function computeFinalStatus(
  checkInTime: string | undefined,
  checkOutTime: string | undefined,
  isLate: boolean,
  fullDayHours: number = FULL_DAY_HOURS,
  halfDayHours: number = HALF_DAY_HOURS
): AttendanceStatus {
  if (!checkInTime) return "absent";
  if (!checkOutTime) return "checked_in";
  const hours = calculateWorkingHours(checkInTime, checkOutTime);
  if (hours >= fullDayHours) return isLate ? "late" : "present";
  if (hours >= halfDayHours) return "half_day";
  if (hours > 0) return "short_hours";
  return "checked_in";
}

export function createAttendanceFromEvent(
  event: AttendanceEventInput,
  settings: SchoolSettings = DEFAULT_SETTINGS,
  employmentType: EmploymentType = "full_time"
) {
  const date = toDateKey(event.timestamp, settings.timezone);
  const status = event.eventType === "checkin" ? "checked_in" : "not_marked";
  const createdAt = nowIso();
  const checkInStatus = event.eventType === "checkin" ? getAttendanceStatus(event.timestamp, settings, employmentType) : undefined;
  const record: AttendanceRecord = {
    teacherId: event.teacherId,
    date,
    month: toMonthKey(event.timestamp, settings.timezone),
    year: getYear(event.timestamp, settings.timezone),
    status: status as AttendanceStatus,
    checkInTime: event.eventType === "checkin" ? event.timestamp : undefined,
    checkOutTime: event.eventType === "checkout" ? event.timestamp : undefined,
    source: event.source,
    sourcesUsed: [event.source],
    latitude: event.gps?.latitude,
    longitude: event.gps?.longitude,
    distanceFromCampus: event.distanceFromCampus,
    deviceInfo: event.deviceInfo,
    biometricDeviceId: event.biometricDeviceId,
    lateMinutes: checkInStatus?.lateMinutes ?? 0,
    isLate: checkInStatus?.isLate ?? false,
    remarks: event.remarks,
    adminEdited: false,
    createdAt,
    updatedAt: createdAt
  };
  return record;
}

export function mergeAttendanceEvent(
  existing: AttendanceRecord | undefined,
  event: AttendanceEventInput,
  settings: SchoolSettings = DEFAULT_SETTINGS,
  employmentType: EmploymentType = "full_time"
) {
  if (!existing) return createAttendanceFromEvent(event, settings, employmentType);

  const updated: AttendanceRecord = {
    ...existing,
    sourcesUsed: Array.from(new Set([...existing.sourcesUsed, event.source])),
    updatedAt: nowIso()
  };

  if (event.eventType === "checkin") {
    if (!updated.checkInTime || new Date(event.timestamp) < new Date(updated.checkInTime)) {
      const checkInStatus = getAttendanceStatus(event.timestamp, settings, employmentType);
      updated.checkInTime = event.timestamp;
      updated.isLate = checkInStatus.isLate;
      updated.lateMinutes = checkInStatus.lateMinutes;
      updated.status = "checked_in";
      updated.source = event.source;
      updated.latitude = event.gps?.latitude ?? updated.latitude;
      updated.longitude = event.gps?.longitude ?? updated.longitude;
      updated.distanceFromCampus = event.distanceFromCampus ?? updated.distanceFromCampus;
      updated.deviceInfo = event.deviceInfo ?? updated.deviceInfo;
      updated.biometricDeviceId = event.biometricDeviceId ?? updated.biometricDeviceId;
    }
  }

  if (event.eventType === "checkout") {
    if (!updated.checkOutTime || new Date(event.timestamp) > new Date(updated.checkOutTime)) {
      updated.checkOutTime = event.timestamp;
      updated.source = updated.source ?? event.source;
      updated.biometricDeviceId = event.biometricDeviceId ?? updated.biometricDeviceId;
      if (updated.checkInTime) {
        updated.status = computeFinalStatus(updated.checkInTime, updated.checkOutTime, updated.isLate);
      }
    }
  }

  return updated;
}

export function getAttendancePercentage(records: AttendanceRecord[]) {
  const working = records.filter((item) => item.status !== "holiday");
  if (working.length === 0) return 0;
  const attended = working.filter(
    (item) => item.status === "present" || item.status === "late" || item.status === "cl" || item.status === "checked_in" || item.status === "half_day" || item.status === "short_hours"
  );
  return Math.round((attended.length / working.length) * 100);
}
