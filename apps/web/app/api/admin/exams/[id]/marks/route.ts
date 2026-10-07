import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { examMarksBulkSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const MARKS = "exam_marks";

function markDocId(examId: string, studentId: string, subject: string) {
  const safeSubject = subject.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${examId}_${studentId}_${safeSubject}`;
}

// GET /api/admin/exams/[id]/marks — all marks for an exam.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const pageSizeRaw = searchParams.get("pageSize") ?? searchParams.get("limit");
    const cursor = searchParams.get("cursor") || "";
    // Unpaginated default preserved for existing callers; pass pageSize/cursor
    // for bounded pages on large exams (doc ids are deterministic, so the
    // documentId order is a stable cursor).
    if (!pageSizeRaw && !cursor) {
      const snap = await adminDb().collection(MARKS).where("examId", "==", params.id).limit(5000).get();
      const marks = snap.docs.map((doc) => serializeDoc(doc));
      return json({ ok: true, marks });
    }
    const pageSize = Math.min(Math.max(Number(pageSizeRaw) || 200, 1), 1000);
    let paged: FirebaseFirestore.Query = adminDb()
      .collection(MARKS)
      .where("examId", "==", params.id)
      .orderBy(FieldPath.documentId());
    if (cursor) paged = paged.startAfter(cursor);
    const snap = await paged.limit(pageSize + 1).get();
    const hasMore = snap.docs.length > pageSize;
    const marks = snap.docs.slice(0, pageSize).map((doc) => serializeDoc(doc));
    return json({
      ok: true,
      marks,
      hasMore,
      nextCursor: hasMore ? snap.docs[pageSize - 1].id : null
    });
  } catch (error) {
    console.error("[ExamsAPI] marks GET failed:", error instanceof Error ? error.message : error);
    return json({ ok: false, error: "Unable to load marks" }, { status: 500 });
  }
}

// POST /api/admin/exams/[id]/marks — bulk enter/update marks (upsert by student+subject).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { marks } = examMarksBulkSchema.parse(await req.json());
    const db = adminDb();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    for (const m of marks) {
      const ref = db.collection(MARKS).doc(markDocId(params.id, m.studentId, m.subject));
      batch.set(ref, { ...m, examId: params.id, updatedAt: now }, { merge: true });
    }
    await batch.commit();
    return json({ ok: true, saved: marks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save marks";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

