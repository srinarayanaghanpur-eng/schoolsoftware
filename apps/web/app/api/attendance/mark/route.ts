import { NextResponse } from "next/server";
import {
  createAttendanceDocumentId,
  getDistanceFromCampus,
  isInsideCampus,
  mergeAttendanceEvent,
  mobileAttendancePayloadSchema,
  nowIso,
  toDateKey
} from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { removeUndefinedFields } from "@/lib/firestoreSanitize";
import { getAttendanceRecord, getSchoolSettings, getTeacherById } from "@/lib/firestoreServer";

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

    const isAdmin = decodedToken.role === "admin";
    if (!isAdmin && teacher.uid !== decodedToken.uid) {
      return NextResponse.json({ ok: false, error: "You can only mark your own attendance" }, { status: 403 });
    }

    const schoolSettings = await getSchoolSettings();
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
      settings
    );

    const db = adminDb();
    const batch = db.batch();
    
    // Mark attendance
    batch.set(db.collection("attendance").doc(attendanceDocumentId), removeUndefinedFields(attendance), { merge: true });
    
    // Log attendance event
    batch.set(db.collection("attendance_logs").doc(), removeUndefinedFields({
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
    }));
    
    // ========== CASUAL LEAVE AUTO-DEDUCTION ==========
    // Update teacher's CL balance based on attendance status
    const month = date.slice(0, 7); // Extract "YYYY-MM" from date
    const clUpdateData: Record<string, unknown> = {
      updatedAt: nowIso()
    };
    
    if (attendance.status === "late") {
      // Increment late entries this month
      const newLateCount = (teacher.lateEntriesThisMonth ?? 0) + 1;
      clUpdateData.lateEntriesThisMonth = newLateCount;
      
      // Every 3 lates = 1 CL deducted
      if (newLateCount % 3 === 0) {
        clUpdateData.casualLeaveBalance = Math.max(0, (teacher.casualLeaveBalance ?? 3) - 1);
      }
    } else if (attendance.status === "absent") {
      // Increment absent days this month
      clUpdateData.absentDaysThisMonth = (teacher.absentDaysThisMonth ?? 0) + 1;
      
      // 1 absent = 1 CL deducted immediately
      clUpdateData.casualLeaveBalance = Math.max(0, (teacher.casualLeaveBalance ?? 3) - 1);
      clUpdateData.casualLeaveUsedThisMonth = (teacher.casualLeaveUsedThisMonth ?? 0) + 1;
    } else if (attendance.status === "present") {
      // Present day - no CL deduction, just ensure tracking fields exist
      if (!teacher.lateEntriesThisMonth) clUpdateData.lateEntriesThisMonth = 0;
      if (!teacher.absentDaysThisMonth) clUpdateData.absentDaysThisMonth = 0;
      if (!teacher.casualLeaveUsedThisMonth) clUpdateData.casualLeaveUsedThisMonth = 0;
      if (teacher.casualLeaveBalance === undefined) clUpdateData.casualLeaveBalance = 3;
    }
    
    // Update teacher document with CL changes
    batch.set(db.collection("teachers").doc(payload.teacherId), clUpdateData, { merge: true });
    
    await batch.commit();

    return NextResponse.json({ ok: true, attendance, gpsRequired });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to mark attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
