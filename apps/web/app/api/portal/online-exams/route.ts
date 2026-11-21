import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizePortalRequest, getPortalLinkedStudents, resolveLinkedStudentId } from "@/lib/portalHelpers";

export const dynamic = "force-dynamic";

// GET /api/portal/online-exams?studentId= — published online exams for a linked student.
export async function GET(req: Request) {
  const auth = await authorizePortalRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Access denied" }, { status: auth.status });

  try {
    const { searchParams } = new URL(req.url);
    const linked = await getPortalLinkedStudents(auth.token);
    const studentId = resolveLinkedStudentId(linked, searchParams.get("studentId"));
    if (!studentId) return NextResponse.json({ ok: false, error: "No student linked" }, { status: 404 });

    const db = adminDb();
    const studentSnap = await db.collection("students").doc(studentId).get();
    if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
    const student = studentSnap.data() as Record<string, unknown>;
    const className = String(student.class || "");
    const section = String(student.section || "");

    const examsSnap = await db
      .collection("online_exams")
      .where("className", "==", className)
      .where("status", "==", "published")
      .limit(100)
      .get();

    const exams = examsSnap.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          title: String(data.title || ""),
          description: String(data.description || ""),
          subject: String(data.subject || ""),
          section: String(data.section || ""),
          durationMinutes: Number(data.durationMinutes || 0),
          totalMarks: Number(data.totalMarks || 0),
          questionCount: Array.isArray(data.questions) ? data.questions.length : 0,
          startAt: String(data.startAt || ""),
          endAt: String(data.endAt || "")
        };
      })
      .filter((exam) => !exam.section || !section || exam.section === section);

    const attemptsSnap = await db.collection("online_exam_attempts").where("studentId", "==", studentId).limit(100).get();
    const attempts = attemptsSnap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        examId: String(data.examId || ""),
        obtainedMarks: Number(data.obtainedMarks || 0),
        totalMarks: Number(data.totalMarks || 0),
        percent: Number(data.totalMarks) > 0 ? Math.round((Number(data.obtainedMarks) / Number(data.totalMarks)) * 1000) / 10 : 0,
        submittedAt: data.submittedAt ?? null
      };
    });

    return NextResponse.json({ ok: true, exams, attempts, student: { id: studentId, name: String(student.studentName || ""), className, section } });
  } catch (error) {
    console.error("[PortalOnlineExams] failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Unable to load online exams" }, { status: 500 });
  }
}
