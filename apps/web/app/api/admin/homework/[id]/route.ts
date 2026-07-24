import { FieldValue } from "firebase-admin/firestore";
import { homeworkUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "homework";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection(COLLECTION).doc(params.id).get();
  if (!snap.exists) return json({ ok: false, error: "Homework not found" }, { status: 404 });

  const homework = serializeDoc(snap as FirebaseFirestore.QueryDocumentSnapshot);

  const submissionsSnap = await adminDb().collection("homework_submissions")
    .where("homeworkId", "==", params.id)
    .limit(200)
    .get();

  const submissions = submissionsSnap.docs.map((d) => serializeDoc(d));

  return json({ ok: true, homework, submissions });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = homeworkUpdateSchema.parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Homework not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update homework";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  await db.collection(COLLECTION).doc(params.id).delete();

  const submissions = await db.collection("homework_submissions")
    .where("homeworkId", "==", params.id)
    .get();
  const batch = db.batch();
  submissions.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  return json({ ok: true, deletedSubmissions: submissions.size });
}
