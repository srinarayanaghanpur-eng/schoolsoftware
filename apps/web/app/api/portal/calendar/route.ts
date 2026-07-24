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
  const year = searchParams.get("year") || new Date().getFullYear().toString();

  if (studentId) {
    const linked = await verifyStudentLinked(token, studentId);
    if (!linked) return NextResponse.json({ ok: false, error: "Student not linked" }, { status: 403 });
  }

  const db = adminDb();

  const holidaysSnap = await db.collection("holidays")
    .where("year", "==", year)
    .orderBy("date", "asc")
    .get();

  const holidays = holidaysSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: data.title,
      date: data.date,
      type: data.type || "holiday",
      description: data.description || "",
    };
  });

  const examsSnap = await db.collection("exams")
    .orderBy("startDate", "asc")
    .limit(50)
    .get();

  const exams = examsSnap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: data.name,
      startDate: data.startDate,
      endDate: data.endDate,
      type: "exam",
      className: data.className,
    };
  });

  return NextResponse.json({ ok: true, holidays, exams });
}
