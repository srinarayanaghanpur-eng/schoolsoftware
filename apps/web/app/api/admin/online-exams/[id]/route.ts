import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { onlineExamUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "online_exams";

// GET /api/admin/online-exams/[id]
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(COLLECTION).doc(params.id).get();
    if (!snap.exists) return json({ ok: false, error: "Online exam not found" }, { status: 404 });
    return json({ ok: true, exam: serializeDoc(snap as FirebaseFirestore.QueryDocumentSnapshot) });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to load online exam") }, { status: 500 });
  }
}

// PATCH /api/admin/online-exams/[id] — edit questions or change status.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const tooLarge = enforceBodyLimit(req, 256 * 1024);
  if (tooLarge) return tooLarge;

  try {
    const parsed = onlineExamUpdateSchema.parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Online exam not found" }, { status: 404 });

    const update: Record<string, unknown> = { ...parsed, updatedAt: FieldValue.serverTimestamp() };
    if (parsed.questions) {
      const invalid = parsed.questions.findIndex((question) => question.correctIndex >= question.options.length);
      if (invalid >= 0) {
        return json({ ok: false, error: `Question ${invalid + 1}: correct option is out of range` }, { status: 400 });
      }
      update.questions = parsed.questions.map((question) => ({ ...question, id: question.id || randomUUID() }));
      update.totalMarks = parsed.questions.reduce((sum, question) => sum + (Number(question.marks) || 0), 0);
    }
    await ref.update(update);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to update online exam") }, { status: 400 });
  }
}

// DELETE /api/admin/online-exams/[id] — removes the exam and its attempts.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const db = adminDb();
    await db.collection(COLLECTION).doc(params.id).delete();
    let deletedAttempts = 0;
    for (;;) {
      const attempts = await db.collection("online_exam_attempts").where("examId", "==", params.id).limit(500).get();
      if (attempts.empty) break;
      const batch = db.batch();
      attempts.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deletedAttempts += attempts.size;
      if (attempts.size < 500) break;
    }
    return json({ ok: true, deletedAttempts });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to delete online exam") }, { status: 500 });
  }
}
