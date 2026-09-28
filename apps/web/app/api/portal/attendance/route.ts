import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizePortalRequest, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const access = await authorizePortalRequest(req);
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.status === 401 ? "Authentication required" : "Portal access denied" },
      { status: access.status }
    );
  }
  const { token } = access;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const monthRaw = searchParams.get("month") || defaultMonth;
  // The month flows into a Firestore equality filter — accept only YYYY-MM.
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthRaw) ? monthRaw : defaultMonth;

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
