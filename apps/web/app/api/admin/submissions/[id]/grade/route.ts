import { FieldValue } from "firebase-admin/firestore";
import { homeworkSubmissionGradeSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = homeworkSubmissionGradeSchema.parse(await req.json());
    const ref = adminDb().collection("homework_submissions").doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Submission not found" }, { status: 404 });
    await ref.update({
      ...parsed,
      gradedBy: token.uid,
      gradedAt: new Date().toISOString(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to grade submission";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  await adminDb().collection("homework_submissions").doc(params.id).delete();
  return json({ ok: true });
}
