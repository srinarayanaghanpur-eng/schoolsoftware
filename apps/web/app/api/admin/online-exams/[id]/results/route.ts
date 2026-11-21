import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { readLimit } from "@/lib/firestoreReadLogger";

// GET /api/admin/online-exams/[id]/results — attempts with score summary.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const limit = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 200, 1000);
    const db = adminDb();
    const examSnap = await db.collection("online_exams").doc(params.id).get();
    if (!examSnap.exists) return json({ ok: false, error: "Online exam not found" }, { status: 404 });
    const exam = examSnap.data() as Record<string, unknown>;
    const totalMarks = Number(exam.totalMarks || 0);

    const snapshot = await db
      .collection("online_exam_attempts")
      .where("examId", "==", params.id)
      .limit(limit)
      .get();

    const attempts = snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const obtained = Number(data.obtainedMarks || 0);
        return {
          id: doc.id,
          studentId: String(data.studentId ?? ""),
          studentName: String(data.studentName ?? ""),
          admissionNumber: String(data.admissionNumber ?? ""),
          className: String(data.className ?? ""),
          section: String(data.section ?? ""),
          obtainedMarks: obtained,
          totalMarks: Number(data.totalMarks || totalMarks),
          percent: totalMarks > 0 ? Math.round((obtained / totalMarks) * 1000) / 10 : 0,
          correct: Number(data.correct ?? 0),
          wrong: Number(data.wrong ?? 0),
          unanswered: Number(data.unanswered ?? 0),
          submittedAt: data.submittedAt ?? null
        };
      })
      .sort((a, b) => b.obtainedMarks - a.obtainedMarks || a.studentName.localeCompare(b.studentName));

    const average = attempts.length > 0 ? Math.round((attempts.reduce((sum, item) => sum + item.percent, 0) / attempts.length) * 10) / 10 : 0;
    return json({ ok: true, attempts, totalMarks, average, truncated: snapshot.size >= limit });
  } catch (error) {
    console.error("[OnlineExamsAPI] results failed:", errorMessage(error));
    return json({ ok: false, error: "Unable to load results" }, { status: 500 });
  }
}
