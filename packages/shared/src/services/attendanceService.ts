import { DEFAULT_SETTINGS } from "../constants";
import type {
  AttendanceEventType,
  AttendanceRecord,
  AttendanceSource,
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

export function getAttendanceStatus(checkInTime: string, settings: SchoolSettings = DEFAULT_SETTINGS) {
  const time = getTimePartsInZone(checkInTime, settings.timezone);
  const checkInMinutes = time.hour * 60 + time.minute;
  const allowedMinutes = minutesFromClock(settings.schoolStartTime) + settings.graceMinutes;
  const lateMinutes = Math.max(0, checkInMinutes - allowedMinutes);
  return {
    status: lateMinutes > 0 ? "late" : "present",
    isLate: lateMinutes > 0,
    lateMinutes
  } as const;
}

export function createAttendanceFromEvent(event: AttendanceEventInput, settings: SchoolSettings = DEFAULT_SETTINGS) {
  const date = toDateKey(event.timestamp, settings.timezone);
  const status = event.eventType === "checkin" ? getAttendanceStatus(event.timestamp, settings) : undefined;
  const createdAt = nowIso();
  const record: AttendanceRecord = {
    teacherId: event.teacherId,
    date,
    month: toMonthKey(event.timestamp, settings.timezone),
    year: getYear(event.timestamp, settings.timezone),
    status: status?.status ?? "not_marked",
    checkInTime: event.eventType === "checkin" ? event.timestamp : undefined,
    checkOutTime: event.eventType === "checkout" ? event.timestamp : undefined,
    source: event.source,
    sourcesUsed: [event.source],
    latitude: event.gps?.latitude,
    longitude: event.gps?.longitude,
    distanceFromCampus: event.distanceFromCampus,
    deviceInfo: event.deviceInfo,
    biometricDeviceId: event.biometricDeviceId,
    lateMinutes: status?.lateMinutes ?? 0,
    isLate: status?.isLate ?? false,
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
  settings: SchoolSettings = DEFAULT_SETTINGS
) {
  if (!existing) return createAttendanceFromEvent(event, settings);

  const updated: AttendanceRecord = {
    ...existing,
    sourcesUsed: Array.from(new Set([...existing.sourcesUsed, event.source])),
    updatedAt: nowIso()
  };

  if (event.eventType === "checkin") {
    if (!updated.checkInTime || new Date(event.timestamp) < new Date(updated.checkInTime)) {
      const status = getAttendanceStatus(event.timestamp, settings);
      updated.checkInTime = event.timestamp;
      updated.status = status.status;
      updated.isLate = status.isLate;
      updated.lateMinutes = status.lateMinutes;
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
    }
  }

  return updated;
}

export function getAttendancePercentage(records: AttendanceRecord[]) {
  const working = records.filter((item) => item.status !== "holiday");
  if (working.length === 0) return 0;
  const attended = working.filter((item) => item.status === "present" || item.status === "late" || item.status === "cl");
  return Math.round((attended.length / working.length) * 100);
}
