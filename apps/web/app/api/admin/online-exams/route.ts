import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { onlineExamCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { examWindowState } from "@/lib/examSchedule";
import { readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "online_exams";

function withQuestionIds(questions: { id?: string }[]) {
  return questions.map((question) => ({ ...question, id: question.id || randomUUID() }));
}

function totalMarks(questions: { marks?: number }[]) {
  return questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
}

// GET /api/admin/online-exams?academicYearId=&className=&status=&pageSize=
export async function GET(req: Request) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId") || "";
    const className = searchParams.get("className") || "";
    const status = searchParams.get("status") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 50, 200);
    const db = adminDb();

    let query: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (className) query = query.where("className", "==", className);
    if (status) query = query.where("status", "==", status);

    let snapshot;
    try {
      snapshot = await query.orderBy("createdAt", "desc").limit(pageSize).get();
    } catch (queryError) {
      const code = String((queryError as { code?: unknown })?.code ?? "");
      const message = errorMessage(queryError, "");
      if (code !== "9" && !/FAILED_PRECONDITION|requires an index/i.test(message)) throw queryError;
      snapshot = await query.limit(pageSize).get();
    }

    const exams = [...snapshot.docs]
      .sort((a, b) => {
        const left = (a.data().createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0;
        const right = (b.data().createdAt as FirebaseFirestore.Timestamp | undefined)?.toMillis() ?? 0;
        return right - left;
      })
      .map((doc) => serializeDoc(doc))
      .map((exam) => ({
        ...exam,
        questionCount: Array.isArray(exam.questions) ? exam.questions.length : 0,
        totalMarks: Array.isArray(exam.questions) ? totalMarks(exam.questions as { marks?: number }[]) : 0,
        window: examWindowState(String(exam.startAt ?? ""), String(exam.endAt ?? ""))
      }));
    return json({ ok: true, exams });
  } catch (error) {
    console.error("[OnlineExamsAPI] GET failed:", errorMessage(error));
    return json({ ok: false, error: "Unable to load online exams" }, { status: 500 });
  }
}

// POST /api/admin/online-exams — create an MCQ-based online exam.
export async function POST(req: Request) {
  const token = await requirePermission(req, "exams.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const tooLarge = enforceBodyLimit(req, 256 * 1024);
  if (tooLarge) return tooLarge;

  try {
    const parsed = onlineExamCreateSchema.parse(await req.json());
    const invalid = parsed.questions.findIndex((question) => question.correctIndex >= question.options.length);
    if (invalid >= 0) {
      return json({ ok: false, error: `Question ${invalid + 1}: correct option is out of range` }, { status: 400 });
    }
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      questions: withQuestionIds(parsed.questions),
      totalMarks: totalMarks(parsed.questions),
      schoolId: getSchoolId(token),
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to create online exam") }, { status: 400 });
  }
}
