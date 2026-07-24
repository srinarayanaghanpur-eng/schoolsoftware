import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// POST /api/admin/exams/[id]/publish — publish results (status = "published").
// Requires the approve permission (principal/admin).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "exams.approve");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const ref = adminDb().collection("exams").doc(params.id);
  if (!(await ref.get()).exists) return json({ ok: false, error: "Exam not found" }, { status: 404 });
  await ref.update({ status: "published", updatedAt: FieldValue.serverTimestamp() });
  return json({ ok: true });
}

