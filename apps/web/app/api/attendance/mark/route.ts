import { NextResponse } from "next/server";
import {
  ATTENDANCE_WINDOWS,
  createAttendanceDocumentId,
  getDistanceFromCampus,
  isInsideCampus,
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
import { removeUndefinedFields } from "@/lib/firestoreSanitize";
import { getAttendanceRecord, getHolidayByDate, getSchoolSettings, getTeacherById } from "@/lib/firestoreServer";

function getEffectiveGpsSettings(
  teacher: NonNullable<Awaited<ReturnType<typeof getTeacherById>>>,
  settings: Awaited<ReturnType<typeof getSchoolSettings>>
) {
  return {
    gpsRequired: teacher.gpsEnabled !== false,
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

    const payload = mobileAttendancePayloadSchema.parse(await req.json());
    const teacher = await getTeacherById(payload.teacherId);
    if (!teacher || teacher.status !== "active") {
      return NextResponse.json({ ok: false, error: "Active teacher profile not found" }, { status: 404 });
    }

    const isAdmin = decodedToken.role === "admin" || decodedToken.role === "super_admin";
    if (!isAdmin && teacher.uid !== decodedToken.uid) {
      return NextResponse.json({ ok: false, error: "You can only mark your own attendance" }, { status: 403 });
    }

    const schoolSettings = await getSchoolSettings();

    // ===== Management-declared holiday: no check-in or check-out required =====
    const attendanceDate = toDateKey(payload.timestamp, schoolSettings.timezone);
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
    const distanceFromCampus = gps ? getDistanceFromCampus(gps, settings) : undefined;

    if (gpsRequired && !gps) {
      return NextResponse.json(
        {
          ok: false,
          error: "GPS location is required for this teacher. Ask admin to disable GPS or update the teacher GPS location."
        },
        { status: 400 }
      );
    }

    if (gpsRequired && gps && !isInsideCampus(gps, settings)) {
      return NextResponse.json(
        {
          ok: false,
          error: "You are outside campus. Attendance not allowed.",
          distanceFromCampus,
          allowedRadius: settings.geofenceRadiusMeters
        },
        { status: 403 }
      );
    }

    // ===== Time-window enforcement (admins may mark outside the window) =====
    const employmentType = teacher.employmentType ?? "full_time";
    const window = ATTENDANCE_WINDOWS[employmentType] ?? ATTENDANCE_WINDOWS.full_time;
    if (!isAdmin) {
      if (payload.eventType === "checkin" && !isWithinCheckInWindow(payload.timestamp, settings, employmentType)) {
        return NextResponse.json(
          { ok: false, error: `Check-in is only allowed between ${window.checkInStart} and ${window.checkInEnd}.` },
          { status: 403 }
        );
      }
      if (payload.eventType === "checkout" && !isWithinCheckOutWindow(payload.timestamp, settings, employmentType)) {
        return NextResponse.json(
          { ok: false, error: `Check-out is only allowed between ${window.checkOutStart} and ${window.checkOutEnd}.` },
          { status: 403 }
        );
      }
    }

    const date = toDateKey(payload.timestamp, settings.timezone);
    const attendanceDocumentId = createAttendanceDocumentId(payload.teacherId, date);
    const existing = await getAttendanceRecord(attendanceDocumentId);
    const attendance = mergeAttendanceEvent(
      existing,
      {
        teacherId: payload.teacherId,
        timestamp: payload.timestamp,
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

    // Use a transaction so the CL deduction reads the freshest late-entry count atomically
    await db.runTransaction(async (transaction) => {
      // Mark attendance
      transaction.set(attendanceRef, removeUndefinedFields(attendance), { merge: true });

      // Read the latest teacher data – no race possible inside a transaction
      const teacherSnap = await transaction.get(teacherRef);
      const latest = teacherSnap.data() ?? {};

      const clUpdate: Record<string, unknown> = { updatedAt: nowIso() };

      if (attendance.status === "late") {
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
      } else if (attendance.status === "present") {
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
      timestamp: payload.timestamp,
      source: "mobile",
      eventType: payload.eventType,
      latitude: payload.latitude,
      longitude: payload.longitude,
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
