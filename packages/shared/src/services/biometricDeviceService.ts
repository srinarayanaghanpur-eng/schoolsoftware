import { biometricPayloadSchema } from "../types/schemas";
import type { BiometricLog, Teacher, SchoolSettings, AttendanceRecord } from "../types/models";
import { createAttendanceDocumentId, mergeAttendanceEvent } from "./attendanceService";
import { nowIso, toDateKey } from "../utils/date";

export type ProcessBiometricLogInput = {
  payload: unknown;
  teachers: Teacher[];
  existingAttendance?: AttendanceRecord;
  settings: SchoolSettings;
};

export function validateBiometricSecret(requestSecret: string | null, configuredSecret?: string) {
  return Boolean(configuredSecret && requestSecret && requestSecret === configuredSecret);
}

export function processBiometricLog(input: ProcessBiometricLogInput) {
  const payload = biometricPayloadSchema.parse(input.payload);
  const teacher = input.teachers.find((item) => item.biometricUserId === payload.biometricUserId);
  const createdAt = nowIso();
  const rawLog: BiometricLog = {
    deviceId: payload.deviceId,
    biometricUserId: payload.biometricUserId,
    teacherId: teacher?.id,
    timestamp: payload.timestamp,
    verificationType: payload.verificationType,
    eventType: payload.eventType,
    rawPayload: input.payload,
    processed: Boolean(teacher),
    errorMessage: teacher ? undefined : "No teacher found for biometric user ID",
    createdAt
  };

  if (!teacher) {
    return { rawLog, attendance: undefined, attendanceDocumentId: undefined };
  }

  const attendance = mergeAttendanceEvent(
    input.existingAttendance,
    {
      teacherId: teacher.id,
      timestamp: payload.timestamp,
      source: "biometric",
      eventType: payload.eventType,
      biometricDeviceId: payload.deviceId,
      rawData: payload
    },
    input.settings
  );
  const date = toDateKey(payload.timestamp, input.settings.timezone);

  return {
    rawLog,
    attendance,
    attendanceDocumentId: createAttendanceDocumentId(teacher.id, date)
  };
}

export async function pollEsslDevicePlaceholder() {
  // Real ESSL models differ: some push logs, others require SDK/TCP polling.
  // Add vendor SDK calls here and forward normalized logs to processBiometricLog().
  return [];
}
