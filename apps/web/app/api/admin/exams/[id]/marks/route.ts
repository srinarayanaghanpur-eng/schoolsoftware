import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { examMarksBulkSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const MARKS = "exam_marks";

function markDocId(examId: string, studentId: string, subject: string) {
  const safeSubject = subject.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return `${examId}_${studentId}_${safeSubject}`;
}

// GET /api/admin/exams/[id]/marks — all marks for an exam.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection(MARKS).where("examId", "==", params.id).limit(5000).get();
  const marks = snap.docs.map((doc) => serializeDoc(doc));
  return NextResponse.json({ ok: true, marks });
}

// POST /api/admin/exams/[id]/marks — bulk enter/update marks (upsert by student+subject).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

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
    return NextResponse.json({ ok: true, saved: marks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save marks";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
