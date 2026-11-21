import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { onlineExamSubmitSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { authorizePortalRequest, getPortalLinkedStudents, resolveLinkedStudentId } from "@/lib/portalHelpers";

export const dynamic = "force-dynamic";

type Question = { id?: string; prompt?: string; options?: string[]; correctIndex?: number; marks?: number };

function examWindow(open: string, close: string) {
  const now = Date.now();
  if (open && new Date(open).getTime() > now) return "not_started";
  if (close && new Date(close).getTime() < now) return "closed";
  return "open";
}

// GET /api/portal/online-exams/[id]?studentId= — question paper without answer keys.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizePortalRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Access denied" }, { status: auth.status });

  try {
    const { searchParams } = new URL(req.url);
    const linked = await getPortalLinkedStudents(auth.token);
    const studentId = resolveLinkedStudentId(linked, searchParams.get("studentId"));
    if (!studentId) return NextResponse.json({ ok: false, error: "No student linked" }, { status: 404 });

    const db = adminDb();
    const snap = await db.collection("online_exams").doc(params.id).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Online exam not found" }, { status: 404 });
    const exam = snap.data() as Record<string, unknown>;
    if (exam.status !== "published") return NextResponse.json({ ok: false, error: "Exam is not available" }, { status: 403 });

    const studentSnap = await db.collection("students").doc(studentId).get();
    const student = studentSnap.exists ? (studentSnap.data() as Record<string, unknown>) : {};
    if (String(student.class || "") !== String(exam.className || "")) {
      return NextResponse.json({ ok: false, error: "This exam is not assigned to your class" }, { status: 403 });
    }
    if (exam.section && student.section && String(exam.section) !== String(student.section)) {
      return NextResponse.json({ ok: false, error: "This exam is not assigned to your section" }, { status: 403 });
    }

    const attemptSnap = await db.collection("online_exam_attempts").doc(`${params.id}_${studentId}`).get();
    if (attemptSnap.exists) {
      const attempt = attemptSnap.data() as Record<string, unknown>;
      return NextResponse.json({ ok: true, alreadySubmitted: true, result: attempt, exam: { id: snap.id, title: exam.title } });
    }

    const questions = (Array.isArray(exam.questions) ? (exam.questions as Question[]) : []).map((question) => ({
      id: question.id || "",
      prompt: question.prompt || "",
      options: question.options || [],
      marks: Number(question.marks || 1)
    }));

    return NextResponse.json({
      ok: true,
      exam: {
        id: snap.id,
        title: exam.title || "",
        description: exam.description || "",
        subject: exam.subject || "",
        durationMinutes: Number(exam.durationMinutes || 0),
        totalMarks: Number(exam.totalMarks || 0),
        startAt: exam.startAt || "",
        endAt: exam.endAt || "",
        window: examWindow(String(exam.startAt || ""), String(exam.endAt || ""))
      },
      questions
    });
  } catch (error) {
    console.error("[PortalOnlineExams] GET failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "Unable to load exam" }, { status: 500 });
  }
}

// POST /api/portal/online-exams/[id] — submit answers and auto-grade.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await authorizePortalRequest(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Access denied" }, { status: auth.status });

  try {
    const body = (await req.json()) as { studentId?: string };
    const linked = await getPortalLinkedStudents(auth.token);
    const studentId = resolveLinkedStudentId(linked, body.studentId ?? null);
    if (!studentId) return NextResponse.json({ ok: false, error: "No student linked" }, { status: 404 });
    const { answers } = onlineExamSubmitSchema.parse(body);

    const db = adminDb();
    const examRef = db.collection("online_exams").doc(params.id);
    const examSnap = await examRef.get();
    if (!examSnap.exists) return NextResponse.json({ ok: false, error: "Online exam not found" }, { status: 404 });
    const exam = examSnap.data() as Record<string, unknown>;
    if (exam.status !== "published") return NextResponse.json({ ok: false, error: "Exam is not published" }, { status: 403 });
    if (examWindow(String(exam.startAt || ""), String(exam.endAt || "")) !== "open") {
      return NextResponse.json({ ok: false, error: "Exam is outside the allowed window" }, { status: 403 });
    }

    const attemptRef = db.collection("online_exam_attempts").doc(`${params.id}_${studentId}`);
    if ((await attemptRef.get()).exists) return NextResponse.json({ ok: false, error: "You have already submitted this exam" }, { status: 409 });

    const studentSnap = await db.collection("students").doc(studentId).get();
    const student = studentSnap.exists ? (studentSnap.data() as Record<string, unknown>) : {};
    if (!studentSnap.exists || String(student.class || "") !== String(exam.className || "")) {
      return NextResponse.json({ ok: false, error: "This exam is not assigned to your class" }, { status: 403 });
    }
    if (exam.section && student.section && String(exam.section) !== String(student.section)) {
      return NextResponse.json({ ok: false, error: "This exam is not assigned to your section" }, { status: 403 });
    }
    const questions = Array.isArray(exam.questions) ? (exam.questions as Question[]) : [];
    const negative = Number(exam.negativeMarking || 0);

    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    let obtained = 0;
    let totalMarked = 0;
    for (const question of questions) {
      const marks = Number(question.marks || 1);
      totalMarked += marks;
      const selected = question.id !== undefined ? answers[question.id] : undefined;
      if (selected === undefined) {
        unanswered += 1;
        continue;
      }
      if (selected === question.correctIndex) {
        correct += 1;
        obtained += marks;
      } else {
        wrong += 1;
        obtained -= marks * negative;
      }
    }
    obtained = Math.max(0, Math.round(obtained * 100) / 100);

    const attempt = {
      examId: params.id,
      examTitle: exam.title || "",
      studentId,
      studentName: String(student.studentName || ""),
      admissionNumber: String(student.admissionNumber || ""),
      className: String(student.class || exam.className || ""),
      section: String(student.section || exam.section || ""),
      answers,
      obtainedMarks: obtained,
      totalMarks: totalMarked || Number(exam.totalMarks || 0),
      correct,
      wrong,
      unanswered,
      submittedAt: FieldValue.serverTimestamp()
    };
    await attemptRef.set(attempt);
    return NextResponse.json({ ok: true, result: { ...attempt, submittedAt: new Date().toISOString() } });
  } catch (error) {
    console.error("[PortalOnlineExams] POST failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to submit exam" }, { status: 400 });
  }
}
