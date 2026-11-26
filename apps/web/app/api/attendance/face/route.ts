import { NextResponse } from "next/server";
import {
  ATTENDANCE_BYPASS_GPS_AND_TIME,
  createAttendanceDocumentId,
  faceAttendancePayloadSchema,
  getDistanceFromCampus,
  isWithinCheckInWindow,
  isWithinCheckOutWindow,
  managementHolidayMessage,
  mergeAttendanceEvent,
  nowIso,
  toDateKey
} from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { removeUndefinedFields } from "@/lib/firestoreSanitize";
import { getAttendanceRecord, getHolidayByDate, getSchoolSettings, getTeacherById } from "@/lib/firestoreServer";
import { getSchoolId } from "@/lib/schoolScope";
import {
  getFaceAttendanceSettings,
  getFaceDevice,
  getTeacherByUid,
  getTeacherFace,
  verifyFaceEmbedding
} from "@/lib/faceAttendance";
import { validateCapturedAt } from "../mark/capturedAt";
import { shouldFlagAccuracy, shouldRejectMockLocation } from "../mark/risk";

async function getActiveAcademicYearId() {
  const snapshot = await adminDb()
    .collection("academic_years")
    .where("isActive", "==", true)
    .limit(1)
    .get()
    .catch(() => null);
  return snapshot?.docs[0]?.id ?? "";
}

function getEffectiveGpsSettings(
  teacher: NonNullable<Awaited<ReturnType<typeof getTeacherById>>>,
  settings: Awaited<ReturnType<typeof getSchoolSettings>>
) {
  return {
    gpsRequired: !ATTENDANCE_BYPASS_GPS_AND_TIME,
    settings: {
      ...settings,
      campusLatitude: teacher.gpsLatitude ?? settings.campusLatitude,
      campusLongitude: teacher.gpsLongitude ?? settings.campusLongitude,
      geofenceRadiusMeters: teacher.gpsRadiusMeters ?? settings.geofenceRadiusMeters
    }
  };
}

export async function POST(req: Request) {
  try {
    const decodedToken = await verifyBearerToken(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const tooLarge = enforceBodyLimit(req, 65536);
    if (tooLarge) return tooLarge;

    const payload = faceAttendancePayloadSchema.parse(await req.json());
    const faceSettings = await getFaceAttendanceSettings();
    if (!faceSettings.enabled) {
      return NextResponse.json(
        { ok: false, error: "Face attendance is switched off by the school office." },
        { status: 403 }
      );
    }

    if (payload.modelVersion !== faceSettings.modelVersion) {
      return NextResponse.json(
        { ok: false, error: "Face model mismatch. Update the app or re-enroll the teacher." },
        { status: 400 }
      );
    }

    const teacher = await getTeacherById(payload.teacherId);
    if (!teacher || teacher.status !== "active") {
      return NextResponse.json({ ok: false, error: "Active teacher profile not found" }, { status: 404 });
    }

    const role = await resolveRole(decodedToken);
    const isAdmin = role === "super_admin" || role === "admin";
    const device = await getFaceDevice(payload.deviceId);
    const approved = device?.status === "approved";
    const shared = approved && faceSettings.allowSharedDevices;

    if (!shared) {
      const self = await getTeacherByUid(decodedToken.uid);
      const isSelf = self?.id === teacher.id;
      if (!faceSettings.allowSelfOnUnapprovedDevices || !isSelf) {
        return NextResponse.json(
          {
            ok: false,
            error: approved
              ? "Shared face attendance is switched off. Only the signed-in teacher can check in on this device."
              : "This device is not approved for face attendance. Ask the school office to approve it."
          },
          { status: 403 }
        );
      }
    }

    const limit = await checkRateLimit({
      key: `face_mark:${decodedToken.uid}:${payload.deviceId}`,
      maxRequests: 40,
      windowMinutes: 1
    });
    if (!limit.allowed) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    if (faceSettings.requireLiveness) {
      if (
        payload.livenessPassed !== true ||
        typeof payload.livenessScore !== "number" ||
        payload.livenessScore < 0.7
      ) {
        return NextResponse.json(
          { ok: false, error: "Liveness check failed. Please blink and turn your head as shown." },
          { status: 403 }
        );
      }
    }

    const capturedCheck = validateCapturedAt(payload.capturedAt, Date.now());
    if (!capturedCheck.ok) {
      return NextResponse.json({ ok: false, error: capturedCheck.error }, { status: 400 });
    }
    const effectiveTimestamp = payload.capturedAt ?? payload.timestamp;
    const offlineSync = Boolean(payload.capturedAt);

    if (shouldRejectMockLocation(isAdmin, payload.isMockLocation)) {
      await adminDb()
        .collection("admin_notifications")
        .add({
          type: "mock_location_face_attendance",
          title: "Mock location blocked on face kiosk",
          message: `A ${payload.eventType} attempt for teacher ${payload.teacherId} was rejected because the device reported a mock location.`,
          relatedCollection: "face_attendance_logs",
          teacherId: payload.teacherId,
          eventType: payload.eventType,
          deviceId: payload.deviceId,
          status: "open",
          createdAt: nowIso()
        })
        .catch(() => {});
      return NextResponse.json(
        { ok: false, error: "Mock location detected. Attendance was not recorded." },
        { status: 403 }
      );
    }

    const storedFace = await getTeacherFace(teacher.id);
    const match = verifyFaceEmbedding({
      stored: storedFace,
      observed: payload.observedEmbedding,
      modelVersion: payload.modelVersion,
      threshold: faceSettings.matchThreshold
    });
    if (!match.ok) {
      return NextResponse.json({ ok: false, error: match.error }, { status: 403 });
    }
    if (payload.matchConfidence + 0.1 < match.confidence) {
      return NextResponse.json(
        { ok: false, error: "Face confidence changed during verification. Please scan again." },
        { status: 400 }
      );
    }

    const schoolSettings = await getSchoolSettings();
    const attendanceDate = toDateKey(effectiveTimestamp, schoolSettings.timezone);
    const holidayToday = await getHolidayByDate(attendanceDate);
    if (holidayToday?.type === "management_declared") {
      return NextResponse.json(
        { ok: false, error: managementHolidayMessage(holidayToday), holiday: holidayToday },
        { status: 403 }
      );
    }

    const { gpsRequired, settings } = getEffectiveGpsSettings(teacher, schoolSettings);
    const hasGps = typeof payload.latitude === "number" && typeof payload.longitude === "number";
    const gps = hasGps
      ? {
          latitude: payload.latitude as number,
          longitude: payload.longitude as number,
          accuracyMeters: payload.accuracyMeters
        }
      : undefined;

    let distanceFromCampus = 0;
    if (gpsRequired) {
      if (!gps) {
        return NextResponse.json(
          { ok: false, error: "Location is required to mark face attendance." },
          { status: 400 }
        );
      }
      distanceFromCampus = getDistanceFromCampus(gps, settings);
      if (distanceFromCampus > settings.geofenceRadiusMeters) {
        return NextResponse.json(
          {
            ok: false,
            error: `This device is ${distanceFromCampus} m from campus. Face attendance works only within ${settings.geofenceRadiusMeters} m.`
          },
          { status: 403 }
        );
      }
    }

    if (!ATTENDANCE_BYPASS_GPS_AND_TIME) {
      const employmentType = teacher.employmentType ?? "full_time";
      const inWindow =
        payload.eventType === "checkin"
          ? isWithinCheckInWindow(effectiveTimestamp, settings, employmentType)
          : isWithinCheckOutWindow(effectiveTimestamp, settings, employmentType);
      if (!inWindow) {
        return NextResponse.json(
          {
            ok: false,
            error:
              payload.eventType === "checkin"
                ? "Check-in is not open right now."
                : "Check-out is not open right now."
          },
          { status: 403 }
        );
      }
    }

    const accuracyFlagged = shouldFlagAccuracy(payload.accuracyMeters);
    const date = toDateKey(effectiveTimestamp, settings.timezone);
    const attendanceDocumentId = createAttendanceDocumentId(teacher.id, date);

    if (payload.clientRequestId) {
      const dupeSnap = await adminDb()
        .collection("attendance_logs")
        .where("clientRequestId", "==", payload.clientRequestId)
        .limit(1)
        .get()
        .catch(() => null);
      if (dupeSnap && !dupeSnap.empty) {
        const current = await getAttendanceRecord(attendanceDocumentId);
        return NextResponse.json({
          ok: true,
          attendance: current,
          teacher: { id: teacher.id, fullName: teacher.fullName, employeeId: teacher.employeeId },
          deduped: true
        });
      }
    }

    const existing = await getAttendanceRecord(attendanceDocumentId);
    const employmentType = teacher.employmentType ?? "full_time";
    const attendance = mergeAttendanceEvent(
      existing,
      {
        teacherId: teacher.id,
        timestamp: effectiveTimestamp,
        source: "biometric",
        eventType: payload.eventType,
        gps,
        distanceFromCampus,
        deviceInfo: payload.deviceInfo,
        biometricDeviceId: payload.deviceId
      },
      settings,
      employmentType
    );

    const db = adminDb();
    const attendanceRef = db.collection("attendance").doc(attendanceDocumentId);
    const teacherRef = db.collection("teachers").doc(teacher.id);
    const schoolId = getSchoolId(decodedToken);
    const academicYearId = await getActiveAcademicYearId();
    const attendancePayload = removeUndefinedFields({
      ...attendance,
      schoolId,
      academicYearId,
      capturedAt: payload.capturedAt,
      syncedAt: offlineSync ? nowIso() : undefined,
      syncedLate: offlineSync ? true : undefined,
      accuracyFlagged: accuracyFlagged || undefined,
      isMockLocation: payload.isMockLocation,
      faceDeviceId: payload.deviceId,
      faceMatchConfidence: match.confidence,
      faceLivenessScore: payload.livenessScore,
      faceModelVersion: payload.modelVersion
    });

    await db.runTransaction(async (transaction) => {
      const teacherSnap = await transaction.get(teacherRef);
      const latest = teacherSnap.data() ?? {};
      transaction.set(attendanceRef, attendancePayload, { merge: true });

      const clUpdate: Record<string, unknown> = { updatedAt: nowIso() };
      if (attendance.status === "late" || attendance.status === "short_hours") {
        const newLateCount = (latest.lateEntriesThisMonth ?? 0) + 1;
        clUpdate.lateEntriesThisMonth = newLateCount;
        if (newLateCount % 3 === 0) {
          clUpdate.casualLeaveBalance = Math.max(0, (latest.casualLeaveBalance ?? 3) - 1);
        }
      } else if (attendance.status === "absent") {
        clUpdate.absentDaysThisMonth = (latest.absentDaysThisMonth ?? 0) + 1;
        clUpdate.casualLeaveBalance = Math.max(0, (latest.casualLeaveBalance ?? 3) - 1);
        clUpdate.casualLeaveUsedThisMonth = (latest.casualLeaveUsedThisMonth ?? 0) + 1;
      } else if (["present", "checked_in", "half_day"].includes(attendance.status)) {
        if (latest.lateEntriesThisMonth === undefined) clUpdate.lateEntriesThisMonth = 0;
        if (latest.absentDaysThisMonth === undefined) clUpdate.absentDaysThisMonth = 0;
        if (latest.casualLeaveUsedThisMonth === undefined) clUpdate.casualLeaveUsedThisMonth = 0;
        if (latest.casualLeaveBalance === undefined) clUpdate.casualLeaveBalance = 3;
      }
      transaction.set(teacherRef, clUpdate, { merge: true });
    });

    const logPayload = removeUndefinedFields({
      teacherId: teacher.id,
      date,
      timestamp: effectiveTimestamp,
      source: "biometric",
      verificationType: "face",
      eventType: payload.eventType,
      deviceId: payload.deviceId,
      deviceInfo: payload.deviceInfo,
      clientRequestId: payload.clientRequestId,
      capturedAt: payload.capturedAt,
      syncedLate: offlineSync ? true : undefined,
      schoolId,
      academicYearId,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracyMeters: payload.accuracyMeters,
      accuracyFlagged: accuracyFlagged || undefined,
      isMockLocation: payload.isMockLocation,
      distanceFromCampus,
      gpsRequired,
      faceMatchConfidence: match.confidence,
      faceLivenessScore: payload.livenessScore,
      faceModelVersion: payload.modelVersion,
      createdAt: nowIso()
    });

    await db.collection("attendance_logs").add(logPayload).catch(() => {});
    await db.collection("face_attendance_logs").add(logPayload).catch(() => {});

    return NextResponse.json({
      ok: true,
      attendance,
      teacher: { id: teacher.id, fullName: teacher.fullName, employeeId: teacher.employeeId },
      eventType: payload.eventType,
      gpsRequired,
      matchConfidence: match.confidence
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark face attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
