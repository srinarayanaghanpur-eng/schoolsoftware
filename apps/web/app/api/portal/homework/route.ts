import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!hasPermission(token.role as Role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (!studentId) return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });

  const linked = await verifyStudentLinked(token, studentId);
  if (!linked) return NextResponse.json({ ok: false, error: "Student not linked" }, { status: 403 });

  const db = adminDb();
  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const student = studentSnap.data() as Record<string, unknown>;
  const className = String(student.class || "");

  const homeworkSnap = await db.collection("homework")
    .where("className", "==", className)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  const homework = homeworkSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: data.title,
      subject: data.subject,
      description: data.description,
      dueDate: data.dueDate,
      assignedDate: data.assignedDate,
      attachments: data.attachments || [],
      createdAt: data.createdAt,
    };
  });

  return NextResponse.json({ ok: true, homework });
}
