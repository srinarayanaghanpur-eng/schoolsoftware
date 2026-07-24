import { FieldValue } from "firebase-admin/firestore";
import { examCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "exams";

// GET /api/admin/exams/[id] — single exam.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection(COLLECTION).doc(params.id).get();
  if (!snap.exists) return json({ ok: false, error: "Exam not found" }, { status: 404 });
  return json({ ok: true, exam: serializeDoc(snap as FirebaseFirestore.QueryDocumentSnapshot) });
}

// PATCH /api/admin/exams/[id] — edit exam fields.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = examCreateSchema.partial().parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Exam not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update exam";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

// DELETE /api/admin/exams/[id] — remove exam and its marks.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  await db.collection(COLLECTION).doc(params.id).delete();
  let totalDeletedMarks = 0;
  for (;;) {
    const marks = await db.collection("exam_marks").where("examId", "==", params.id).limit(500).get();
    if (marks.empty) break;
    const batch = db.batch();
    marks.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    totalDeletedMarks += marks.size;
    if (marks.size < 500) break;
  }
  return json({ ok: true, deletedMarks: totalDeletedMarks });
}

