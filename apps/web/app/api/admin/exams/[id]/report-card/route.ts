import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const token = await requirePermission(req, "exams.view");
    if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");

    const db = adminDb();
    const examSnap = await db.collection("exams").doc(params.id).get();
    if (!examSnap.exists) return json({ ok: false, error: "Exam not found" }, { status: 404 });

    const exam = { id: examSnap.id, ...examSnap.data() } as Record<string, unknown>;

    let marksQuery: FirebaseFirestore.Query = db.collection("exam_marks").where("examId", "==", params.id);
    if (studentId) marksQuery = marksQuery.where("studentId", "==", studentId);

    const marksSnap = await marksQuery.get();
    const marks = marksSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as unknown as Array<{
      studentId: string; subject: string; marksObtained: number; maxMarks: number; grade?: string; remarks?: string;
    }>;

    if (studentId) {
      const studentSnap = await db.collection("students").doc(studentId).get();
      const student = studentSnap.data() ?? {};

      const subjects = marks.filter((m) => m.studentId === studentId);
      const totalMarks = subjects.reduce((s, m) => s + m.marksObtained, 0);
      const totalMaxMarks = subjects.reduce((s, m) => s + m.maxMarks, 0);
      const percentage = totalMaxMarks > 0 ? Math.round((totalMarks / totalMaxMarks) * 100 * 100) / 100 : 0;

      const reportCard = {
        studentId,
        studentName: (student as Record<string, unknown>).studentName ?? "",
        className: (student as Record<string, unknown>).class ?? exam.className,
        section: (student as Record<string, unknown>).section ?? exam.section,
        examName: exam.name,
        subjects: subjects.map((m) => ({
          subject: m.subject,
          marksObtained: m.marksObtained,
          maxMarks: m.maxMarks,
          grade: m.grade,
          remarks: m.remarks
        })),
        totalMarks,
        totalMaxMarks,
        percentage,
        grade: percentage >= 90 ? "A+" : percentage >= 75 ? "A" : percentage >= 60 ? "B" : percentage >= 45 ? "C" : percentage >= 33 ? "D" : "F",
        remarks: exam.status === "published" ? "Published" : "Draft"
      };

      return json({ ok: true, reportCard });
    }

    const allStudents = await db.collection("students").where("class", "==", exam.className).limit(300).get();
    const studentsMap = new Map(allStudents.docs.map((d) => [d.id, d.data()]));

    const studentTotals = new Map<string, number>();
    for (const m of marks) {
      studentTotals.set(m.studentId, (studentTotals.get(m.studentId) ?? 0) + m.marksObtained);
    }

    const ranked = [...studentTotals.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([sid], idx) => ({ studentId: sid, rank: idx + 1 }));

    const reportCards = [...studentTotals.entries()].map(([sid, total]) => {
      const studentMarks = marks.filter((m) => m.studentId === sid);
      const totalMax = studentMarks.reduce((s, m) => s + m.maxMarks, 0);
      const pct = totalMax > 0 ? Math.round((total / totalMax) * 100 * 100) / 100 : 0;
      const student = studentsMap.get(sid) as Record<string, unknown> | undefined;
      const rankEntry = ranked.find((r) => r.studentId === sid);

      return {
        studentId: sid,
        studentName: student?.studentName ?? "",
        className: exam.className,
        section: student?.section ?? exam.section,
        examName: exam.name,
        subjects: studentMarks.map((m) => ({
          subject: m.subject, marksObtained: m.marksObtained, maxMarks: m.maxMarks, grade: m.grade, remarks: m.remarks
        })),
        totalMarks: total,
        totalMaxMarks: totalMax,
        percentage: pct,
        grade: pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 60 ? "B" : pct >= 45 ? "C" : pct >= 33 ? "D" : "F",
        rank: rankEntry?.rank,
        remarks: exam.status === "published" ? "Published" : "Draft"
      };
    });

    return json({ ok: true, reportCards });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate report card";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

