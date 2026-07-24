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
  const month = searchParams.get("month") || new Date().toISOString().slice(0, 7);

  if (!studentId) return NextResponse.json({ ok: false, error: "studentId required" }, { status: 400 });

  const linked = await verifyStudentLinked(token, studentId);
  if (!linked) return NextResponse.json({ ok: false, error: "Student not linked" }, { status: 403 });

  const db = adminDb();
  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const student = studentSnap.data() as Record<string, unknown>;
  const studentName = String(student.studentName || "");
  const className = String(student.class || "");
  const section = String(student.section || "");

  const recordsSnap = await db.collection("student_attendance")
    .where("studentId", "==", studentId)
    .where("month", "==", month)
    .orderBy("date", "asc")
    .limit(31)
    .get();

  const attendance = recordsSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      date: data.date,
      status: data.status,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
    };
  });

  const present = attendance.filter((a) => a.status === "present").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const late = attendance.filter((a) => a.status === "late").length;
  const total = attendance.length;
  const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  return NextResponse.json({
    ok: true,
    student: { id: studentId, name: studentName, className, section },
    summary: { present, absent, late, total, percentage },
    attendance,
  });
}
