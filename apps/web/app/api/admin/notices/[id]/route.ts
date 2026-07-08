import { FieldValue } from "firebase-admin/firestore";
import { noticeCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

const COLLECTION = "notices";

// PATCH /api/admin/notices/[id] — edit a notice.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "communication.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = noticeCreateSchema.partial().parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Notice not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update notice";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

// DELETE /api/admin/notices/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "communication.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  await adminDb().collection(COLLECTION).doc(params.id).delete();
  return json({ ok: true });
}

