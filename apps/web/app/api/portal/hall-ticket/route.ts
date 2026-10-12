import { NextResponse } from "next/server";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { resolveRole } from "@/lib/apiUtils";
import { hasPermission } from "@sri-narayana/shared";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

const GENERAL_INSTRUCTIONS = [
  "Report to the exam hall 15 minutes before the scheduled time.",
  "Bring your own stationery (pen, pencil, eraser, ruler).",
  "Mobile phones and electronic devices are strictly prohibited.",
  "No exchange of any materials is allowed during the exam.",
  "Write your admission number clearly on the answer sheet."
];

// GET /api/portal/hall-ticket?examId=&studentId= — own child's hall ticket.
export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const role = await resolveRole(token);
  if (!hasPermission(role, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("examId");
  const studentId = searchParams.get("studentId");
  if (!examId || !studentId) {
    return NextResponse.json({ ok: false, error: "examId and studentId required" }, { status: 400 });
  }

  const linked = await getPortalLinkedStudents(token);
  const valid = linked.some((s) => s.id === studentId) && (await verifyStudentLinked(token, studentId));
  if (!valid) return NextResponse.json({ ok: false, error: "Student not linked" }, { status: 403 });

  const db = adminDb();
  const examSnap = await db.collection("exams").doc(examId).get();
  if (!examSnap.exists) return NextResponse.json({ ok: false, error: "Exam not found" }, { status: 404 });
  const exam = examSnap.data() as Record<string, unknown>;
  if (exam.status !== "published") {
    return NextResponse.json({ ok: false, error: "Hall ticket not available yet" }, { status: 403 });
  }

  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const student = studentSnap.data() as Record<string, unknown>;

  return NextResponse.json({
    ok: true,
    hallTicket: {
      examName: exam.name,
      examType: exam.examType,
      startDate: exam.startDate,
      endDate: exam.endDate,
      studentName: student.studentName,
      className: student.class,
      section: student.section,
      admissionNo: student.admissionNumber,
      studentPhoto: student.photoUrl || null,
      timetable: exam.timetable || [],
      generalInstructions: GENERAL_INSTRUCTIONS
    }
  });
}
