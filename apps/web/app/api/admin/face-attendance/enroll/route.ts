import { NextResponse } from "next/server";
import { faceEnrollmentSchema, normalizeEmbedding } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, requireAdmin } from "@/lib/apiUtils";
import { getFaceAttendanceSettings } from "@/lib/faceAttendance";
import { getTeacherById } from "@/lib/firestoreServer";

export async function POST(req: Request) {
  const token = await requireAdmin(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }
  const tooLarge = enforceBodyLimit(req, 65536);
  if (tooLarge) return tooLarge;

  try {
    const input = faceEnrollmentSchema.parse(await req.json());
    const settings = await getFaceAttendanceSettings();
    if (!settings.enabled) {
      return NextResponse.json(
        { ok: false, error: "Turn on face attendance before enrolling teachers." },
        { status: 403 }
      );
    }
    if (input.modelVersion !== settings.modelVersion) {
      return NextResponse.json(
        { ok: false, error: "Enrollment model version does not match the school setting." },
        { status: 400 }
      );
    }

    const teacher = await getTeacherById(input.teacherId);
    if (!teacher || teacher.status !== "active") {
      return NextResponse.json({ ok: false, error: "Active teacher not found" }, { status: 404 });
    }

    const embedding = normalizeEmbedding(input.embedding);
    if (embedding.length === 0) {
      return NextResponse.json({ ok: false, error: "Face embedding is invalid." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const ref = adminDb().collection("teacher_faces").doc(teacher.id);
    const existing = await ref.get();
    await ref.set(
      {
        teacherId: teacher.id,
        embedding,
        dimensions: embedding.length,
        modelVersion: input.modelVersion,
        sampleCount: input.sampleCount,
        quality: input.quality,
        enrolledByUid: token.uid,
        enrolledAt: existing.exists ? existing.data()?.enrolledAt ?? now : now,
        updatedAt: now
      },
      { merge: true }
    );

    return NextResponse.json({
      ok: true,
      teacher: { id: teacher.id, fullName: teacher.fullName, employeeId: teacher.employeeId },
      dimensions: embedding.length,
      modelVersion: input.modelVersion
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: errorMessage(error, "Unable to save the face enrollment.") },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const token = await requireAdmin(req);
  if (!token) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const teacherId = (new URL(req.url).searchParams.get("teacherId") ?? "").trim();
  if (!teacherId) {
    return NextResponse.json({ ok: false, error: "Teacher ID is required" }, { status: 400 });
  }

  await adminDb().collection("teacher_faces").doc(teacherId).delete();
  return NextResponse.json({ ok: true });
}
