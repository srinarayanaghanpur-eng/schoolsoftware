import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { getPortalLinkedStudents, verifyStudentLinked } from "@/lib/portalHelpers";

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
  if (!hasPermission(token.role as Role | undefined, "portal.view")) {
    return NextResponse.json({ ok: false, error: "Portal access denied" }, { status: 403 });
  }

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const requestedStudentId = searchParams.get("studentId");

  const linkedStudents = await getPortalLinkedStudents(token);
  if (linkedStudents.length === 0) {
    return NextResponse.json({ ok: false, error: "No student linked" }, { status: 404 });
  }

  const studentId = requestedStudentId && linkedStudents.some((s) => s.id === requestedStudentId)
    ? requestedStudentId
    : linkedStudents[0].id;

  const valid = await verifyStudentLinked(token, studentId);
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const studentSnap = await db.collection("students").doc(studentId).get();
  if (!studentSnap.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
  const s = studentSnap.data() as Record<string, unknown>;

  const marksSnap = await db.collection("exam_marks").where("studentId", "==", studentId).get();
  const examIds = [...new Set(marksSnap.docs.map((d) => d.data().examId as string))];

  const examsMap = new Map<string, { name: string; status: string; examType: string; startDate?: string; endDate?: string; className: string }>();
  await Promise.all(
    examIds.map(async (eid) => {
      const ex = await db.collection("exams").doc(eid).get();
      if (ex.exists) {
        const d = ex.data() as Record<string, unknown>;
        examsMap.set(eid, {
          name: (d.name as string) || "",
          status: (d.status as string) || "",
          examType: (d.examType as string) || "",
          startDate: d.startDate ? String(d.startDate) : undefined,
          endDate: d.endDate ? String(d.endDate) : undefined,
          className: (d.className as string) || "",
        });
      }
    })
  );

  const allExams = await db.collection("exams")
    .where("className", "==", s.class as string)
    .orderBy("startDate", "asc")
    .get();

  const timetable = allExams.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    return {
      id: doc.id,
      name: d.name || "",
      examType: d.examType || "",
      status: d.status || "",
      startDate: d.startDate ? String(d.startDate) : "",
      endDate: d.endDate ? String(d.endDate) : "",
    };
  });

  const marks = marksSnap.docs.map((d) => {
    const m = d.data();
    const exam = examsMap.get(m.examId);
    return {
      id: d.id,
      examId: m.examId,
      examName: exam?.name || "",
      examStatus: exam?.status || "",
      subject: m.subject || "",
      marksObtained: m.marksObtained || 0,
      maxMarks: m.maxMarks || 0,
      grade: m.grade || "",
      remarks: m.remarks || "",
    };
  });

  const subjectPerformance: Record<string, { total: number; obtained: number; count: number }> = {};
  marks.forEach((m) => {
    if (!subjectPerformance[m.subject]) subjectPerformance[m.subject] = { total: 0, obtained: 0, count: 0 };
    subjectPerformance[m.subject].total += m.maxMarks;
    subjectPerformance[m.subject].obtained += m.marksObtained;
    subjectPerformance[m.subject].count += 1;
  });

  return NextResponse.json({
    ok: true,
    timetable,
    marks,
    subjectPerformance: Object.entries(subjectPerformance).map(([subject, data]) => ({
      subject,
      total: data.total,
      obtained: data.obtained,
      percentage: data.total > 0 ? Math.round((data.obtained / data.total) * 100) : 0,
      exams: data.count,
    })),
  });
}
