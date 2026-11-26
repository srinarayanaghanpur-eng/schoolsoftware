import { NextResponse } from "next/server";
import type { FaceDevice, TeacherFace } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";
import { getActiveTeachers, getFaceAttendanceSettings } from "@/lib/faceAttendance";

export async function GET(req: Request) {
  const token = await requireAdmin(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const db = adminDb();
  const [settings, devicesSnap, facesSnap, teachers] = await Promise.all([
    getFaceAttendanceSettings(),
    db.collection("face_devices").limit(200).get(),
    db.collection("teacher_faces").limit(500).get(),
    getActiveTeachers()
  ]);

  const devices = devicesSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<FaceDevice, "id">) }))
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));

  const faceByTeacher = new Map<string, TeacherFace>();
  facesSnap.docs.forEach((doc) => {
    faceByTeacher.set(doc.id, doc.data() as TeacherFace);
  });

  return NextResponse.json({
    ok: true,
    settings,
    devices,
    teachers: teachers
      .map((teacher) => {
        const face = faceByTeacher.get(teacher.id);
        return {
          id: teacher.id,
          fullName: teacher.fullName,
          employeeId: teacher.employeeId,
          subject: teacher.subject,
          status: teacher.status,
          enrolled: Boolean(face),
          face: face
            ? {
                modelVersion: face.modelVersion,
                sampleCount: face.sampleCount,
                quality: face.quality,
                updatedAt: face.updatedAt
              }
            : null
        };
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
  });
}
