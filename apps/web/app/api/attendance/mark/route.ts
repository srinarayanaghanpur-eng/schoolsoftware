import { NextResponse } from "next/server";
import {
  ATTENDANCE_BYPASS_GPS_AND_TIME,
  createAttendanceDocumentId,
  getDistanceFromCampus,
  isWithinCheckInWindow,
  isWithinCheckOutWindow,
  mergeAttendanceEvent,
  mobileAttendancePayloadSchema,
  nowIso,
  toDateKey
} from "@sri-narayana/shared";
import { FieldValue } from "firebase-admin/firestore";
import { managementHolidayMessage } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { validateCapturedAt } from "./capturedAt";
import { shouldFlagAccuracy, shouldRejectMockLocation } from "./risk";
import { removeUndefinedFields } from "@/lib/firestoreSanitize";
import { getAttendanceRecord, getHolidayByDate, getSchoolSettings, getTeacherById } from "@/lib/firestoreServer";
import { getSchoolId } from "@/lib/schoolScope";

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

async function getActiveAcademicYearId() {
  const snapshot = await adminDb()
    .collection("academic_years")
    .where("isActive", "==", true)
    .limit(1)
    .get()
    .catch(() => null);

  return snapshot?.docs[0]?.id ?? "";
}

export async function POST(req: Request) {
  try {
    const decodedToken = await verifyBearerToken(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const bodyLimit = enforceBodyLimit(req, 8192);
    if (bodyLimit) return bodyLimit;

    const payload = mobileAttendancePayloadSchema.parse(await req.json());
    const teacher = await getTeacherById(payload.teacherId);
    if (!teacher || teacher.status !== "active") {
      return NextResponse.json({ ok: false, error: "Active teacher profile not found" }, { status: 404 });
    }

    // Use DB-resolved role (not stale token claim) so demotions apply within ~60s.
    const role = await resolveRole(decodedToken);
    const isAdmin = role === "super_admin" || role === "admin";
    if (!isAdmin && teacher.uid !== decodedToken.uid) {
      return NextResponse.json({ ok: false, error: "You can only mark your own attendance" }, { status: 403 });
    }

    // Device-ingest endpoint: throttle GPS-spam/retries per account.
    const markLimit = await checkRateLimit({
      key: `attendance-mark:${decodedToken.uid}`,
      maxRequests: 30,
      windowMinutes: 1
    });
    if (!markLimit.allowed) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    // Offline-sync path: accept the client's captured moment only inside a
    // tight window around server time, then run every time-based check
    // (holiday date, windows, doc id) against it — never against sync time.
    const capturedCheck = validateCapturedAt(payload.capturedAt, Date.now());
    if (!capturedCheck.ok) {
      return NextResponse.json({ ok: false, error: capturedCheck.error }, { status: 400 });
    }
    const effectiveTimestamp = payload.capturedAt ?? payload.timestamp;
    const offlineSync = Boolean(payload.capturedAt);

    // A selfie path must live in the caller's own Storage namespace; never
    // trust a client-supplied path that points at another teacher.
    if (
      payload.selfieStoragePath &&
      !payload.selfieStoragePath.startsWith(`attendance-selfies/${payload.teacherId}/`)
    ) {
      return NextResponse.json(
        { ok: false, error: "Selfie path does not belong to this teacher" },
        { status: 403 }
      );
    }

    // Device-reported mock location: non-admin marks are rejected and surfaced
    // to admins. Admins keep the ability to submit test records.
    if (shouldRejectMockLocation(isAdmin, payload.isMockLocation)) {
      await adminDb()
        .collection("admin_notifications")
        .add({
          type: "mock_location_attendance",
          title: "Mock location blocked",
          message: `A ${payload.eventType} attempt from teacher ${payload.teacherId} used a mock location and was rejected.`,
          relatedCollection: "attendance_logs",
          teacherId: payload.teacherId,
          eventType: payload.eventType,
          status: "open",
          createdAt: nowIso()
        })
        .catch(() => {});
      return NextResponse.json(
        { ok: false, error: "Mock location detected. Attendance was not recorded." },
        { status: 403 }
      );
    }

    const schoolSettings = await getSchoolSettings();

    // ===== Management-declared holiday: no check-in or check-out required =====
    const attendanceDate = toDateKey(effectiveTimestamp, schoolSettings.timezone);
    const holidayToday = await getHolidayByDate(attendanceDate);
    if (!isAdmin && holidayToday?.type === "management_declared") {
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

    const employmentType = teacher.employmentType ?? "full_time";

    // Server-side geofence: the mobile/web client check is only a fast-fail UX
    // guard. Without this, location is advisory and can be omitted entirely.
    let distanceFromCampus = 0;
    if (gpsRequired) {
      if (!gps) {
        return NextResponse.json(
          { ok: false, error: "Location is required to mark attendance." },
          { status: 400 }
        );
      }
      distanceFromCampus = getDistanceFromCampus(gps, settings);
      if (distanceFromCampus > settings.geofenceRadiusMeters) {
        return NextResponse.json(
          {
            ok: false,
            error: `You are ${distanceFromCampus} m from campus. Attendance can only be marked within ${settings.geofenceRadiusMeters} m.`
          },
          { status: 403 }
        );
      }
    }

    // Server-side time windows (previously enforced only in the web UI).
    if (!ATTENDANCE_BYPASS_GPS_AND_TIME) {
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
                ? "Check-in is not open right now. Please mark attendance during the check-in window."
                : "Check-out is not open right now. Please mark attendance during the check-out window."
          },
          { status: 403 }
        );
      }
    }

    // Low accuracy is a review signal, not a rejection: venue Wi-Fi and
    // indoor fixes can legitimately exceed 100 m.
    const accuracyFlagged = shouldFlagAccuracy(payload.accuracyMeters);

    const date = toDateKey(effectiveTimestamp, settings.timezone);
    const attendanceDocumentId = createAttendanceDocumentId(payload.teacherId, date);

    // Idempotent retry: the mobile client re-sends the same clientRequestId
    // on network retries. A matching log row means this exact event was
    // already processed — return the current record without writing again.
    if (payload.clientRequestId) {
      const dupeSnap = await adminDb().collection("attendance_logs")
        .where("clientRequestId", "==", payload.clientRequestId)
        .limit(1)
        .get()
        .catch(() => null);
      if (dupeSnap && !dupeSnap.empty) {
        const current = await getAttendanceRecord(attendanceDocumentId);
        return NextResponse.json({ ok: true, attendance: current, gpsRequired, deduped: true });
      }
    }

    const existing = await getAttendanceRecord(attendanceDocumentId);
    const attendance = mergeAttendanceEvent(
      existing,
      {
        teacherId: payload.teacherId,
        timestamp: effectiveTimestamp,
        source: "mobile",
        eventType: payload.eventType,
        gps,
        distanceFromCampus,
        deviceInfo: payload.deviceInfo
      },
      settings,
      employmentType
    );

    const db = adminDb();
    const attendanceRef = db.collection("attendance").doc(attendanceDocumentId);
    const teacherRef = db.collection("teachers").doc(payload.teacherId);
    const schoolId = getSchoolId(decodedToken);
    const academicYearId = await getActiveAcademicYearId();
    const attendancePayload = removeUndefinedFields({
      ...attendance,
      schoolId,
      academicYearId,
      // Offline-sync provenance for admin review (live marks omit these).
      capturedAt: payload.capturedAt,
      syncedAt: offlineSync ? nowIso() : undefined,
      syncedLate: offlineSync ? true : undefined,
      // Anti-fraud review signals (flag, never block).
      accuracyFlagged: accuracyFlagged || undefined,
      selfieStoragePath: payload.selfieStoragePath,
      isMockLocation: payload.isMockLocation
    });

    // Use a transaction so the CL deduction reads the freshest late-entry count atomically
    await db.runTransaction(async (transaction) => {
      // Firestore requires all transaction reads before writes.
      const teacherSnap = await transaction.get(teacherRef);
      const latest = teacherSnap.data() ?? {};

      transaction.set(attendanceRef, attendancePayload, { merge: true });

      const clUpdate: Record<string, unknown> = { updatedAt: nowIso() };

      if (attendance.status === "late" || attendance.status === "short_hours") {
        const newLateCount = (latest.lateEntriesThisMonth ?? 0) + 1;
        clUpdate.lateEntriesThisMonth = newLateCount;
        // Every 3 lates = 1 CL deducted
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

    // Best-effort attendance log outside the transaction (no critical data)
    await db.collection("attendance_logs").add(removeUndefinedFields({
      teacherId: payload.teacherId,
      date,
      timestamp: effectiveTimestamp,
      source: "mobile",
      eventType: payload.eventType,
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
      selfieStoragePath: payload.selfieStoragePath,
      distanceFromCampus,
      gpsRequired,
      deviceInfo: payload.deviceInfo,
      rawData: payload,
      createdAt: nowIso()
    })).catch(() => {});

    return NextResponse.json({ ok: true, attendance, gpsRequired });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
