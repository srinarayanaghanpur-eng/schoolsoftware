import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    const db = adminDb();
    const examSnap = await db.collection("exams").doc(params.id).get();
    if (!examSnap.exists) return json({ ok: false, error: "Exam not found" }, { status: 404 });

    const exam = examSnap.data() as Record<string, unknown>;

    if (studentId) {
      const studentSnap = await db.collection("students").doc(studentId).get();
      if (!studentSnap.exists) return json({ ok: false, error: "Student not found" }, { status: 404 });

      const student = studentSnap.data() as Record<string, unknown>;

      return json({
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
          generalInstructions: [
            "Report to the exam hall 15 minutes before the scheduled time.",
            "Bring your own stationery (pen, pencil, eraser, ruler).",
            "Mobile phones and electronic devices are strictly prohibited.",
            "No exchange of any materials is allowed during the exam.",
            "Write your admission number clearly on the answer sheet.",
          ],
        },
      });
    }

    const studentsSnap = await db.collection("students")
      .where("class", "==", exam.className)
      .where("academicYearId", "==", exam.academicYearId)
      .limit(500)
      .get();

    const hallTickets = studentsSnap.docs.map((s) => {
      const student = s.data() as Record<string, unknown>;
      return {
        examName: exam.name,
        examType: exam.examType,
        startDate: exam.startDate,
        endDate: exam.endDate,
        studentId: s.id,
        studentName: student.studentName,
        className: student.class,
        section: student.section,
        admissionNo: student.admissionNumber,
        timetable: exam.timetable || [],
        generalInstructions: [
          "Report to the exam hall 15 minutes before the scheduled time.",
          "Bring your own stationery (pen, pencil, eraser, ruler).",
          "Mobile phones and electronic devices are strictly prohibited.",
          "No exchange of any materials is allowed during the exam.",
          "Write your admission number clearly on the answer sheet.",
        ],
      };
    });

    return json({ ok: true, hallTickets, total: hallTickets.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate hall ticket";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
