import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import {
  getActiveTeachers,
  getFaceAttendanceSettings,
  getFaceDevice,
  getTeacherByUid,
  getTeacherFace
} from "@/lib/faceAttendance";

export async function GET(req: Request) {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) {
    return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  }

  const url = new URL(req.url);
  const deviceId = (url.searchParams.get("deviceId") ?? "").trim();
  if (!deviceId) {
    return NextResponse.json({ ok: false, error: "Device ID is required" }, { status: 400 });
  }

  const limit = await checkRateLimit({
    key: `face_gallery:${decodedToken.uid}:${deviceId}`,
    maxRequests: 20,
    windowMinutes: 1
  });
  if (!limit.allowed) {
    return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
  }

  const settings = await getFaceAttendanceSettings();
  if (!settings.enabled) {
    return NextResponse.json(
      { ok: false, error: "Face attendance is switched off by the school office." },
      { status: 403 }
    );
  }

  const device = await getFaceDevice(deviceId);
  const approved = device?.status === "approved";
  const shared = approved && settings.allowSharedDevices;

  let teachers;
  if (shared) {
    teachers = await getActiveTeachers();
  } else if (settings.allowSelfOnUnapprovedDevices) {
    const self = await getTeacherByUid(decodedToken.uid);
    teachers = self ? [self] : [];
  } else {
    return NextResponse.json(
      { ok: false, error: "This device is not approved for face attendance. Ask the school office." },
      { status: 403 }
    );
  }

  const candidates = [];
  for (const teacher of teachers) {
    const face = await getTeacherFace(teacher.id);
    if (!face || face.modelVersion !== settings.modelVersion) continue;
    candidates.push({
      teacherId: teacher.id,
      fullName: teacher.fullName,
      employeeId: teacher.employeeId,
      embedding: face.embedding,
      modelVersion: face.modelVersion
    });
  }

  return NextResponse.json({
    ok: true,
    enabled: true,
    deviceStatus: device?.status ?? "pending",
    shared,
    matchThreshold: settings.matchThreshold,
    requireLiveness: settings.requireLiveness,
    modelVersion: settings.modelVersion,
    candidates
  });
}
