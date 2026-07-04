import { NextResponse } from "next/server";
import { createAttendanceDocumentId, managementHolidayMessage, processBiometricLog, toDateKey, validateBiometricSecret } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { removeUndefinedFields } from "@/lib/firestoreSanitize";
import { getAttendanceRecord, getHolidayByDate, getSchoolSettings, getTeacherByBiometricUserId } from "@/lib/firestoreServer";

export async function POST(req: Request) {
  try {
    const settings = await getSchoolSettings();
    const requestSecret = req.headers.get("x-biometric-secret");
    if (!validateBiometricSecret(requestSecret, settings.biometricApiSecret)) {
      return NextResponse.json({ ok: false, error: "Invalid biometric API secret" }, { status: 401 });
    }

    const payload = await req.json();
    const teacher = await getTeacherByBiometricUserId(payload.biometricUserId);

    // Management-declared holiday: keep the raw device log for history but do
    // not create attendance — the day is not a working day.
    if (payload.timestamp) {
      const holidayToday = await getHolidayByDate(toDateKey(payload.timestamp, settings.timezone));
      if (holidayToday?.type === "management_declared") {
        const rawLogRef = await adminDb().collection("biometric_logs").add(removeUndefinedFields({
          ...payload,
          processed: false,
          errorMessage: managementHolidayMessage(holidayToday),
          createdAt: new Date().toISOString()
        }));
        return NextResponse.json({
          ok: false,
          biometricLogId: rawLogRef.id,
          error: managementHolidayMessage(holidayToday)
        });
      }
    }

    const existingAttendance =
      teacher && payload.timestamp
        ? await getAttendanceRecord(createAttendanceDocumentId(teacher.id, toDateKey(payload.timestamp, settings.timezone)))
        : undefined;

    const result = processBiometricLog({
      payload,
      teachers: teacher ? [teacher] : [],
      existingAttendance,
      settings
    });

    const db = adminDb();
    const rawLogRef = await db.collection("biometric_logs").add(removeUndefinedFields(result.rawLog));

    if (result.attendance && result.attendanceDocumentId) {
      await db.collection("attendance").doc(result.attendanceDocumentId).set(removeUndefinedFields(result.attendance), { merge: true });
      await db.collection("attendance_logs").add(removeUndefinedFields({
        teacherId: result.attendance.teacherId,
        date: result.attendance.date,
        timestamp: payload.timestamp,
        source: "biometric",
        eventType: payload.eventType,
        deviceInfo: payload.deviceId,
        rawData: payload,
        createdAt: result.rawLog.createdAt
      }));
    }

    return NextResponse.json({
      ok: result.rawLog.processed,
      biometricLogId: rawLogRef.id,
      attendanceDocumentId: result.attendanceDocumentId,
      error: result.rawLog.errorMessage
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process biometric log";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
