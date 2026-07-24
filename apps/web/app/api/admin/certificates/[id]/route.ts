import { FieldValue } from "firebase-admin/firestore";
import { certificateUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "certificates";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection(COLLECTION).doc(params.id).get();
  if (!snap.exists) return json({ ok: false, error: "Certificate not found" }, { status: 404 });
  return json({ ok: true, certificate: serializeDoc(snap as FirebaseFirestore.QueryDocumentSnapshot) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = certificateUpdateSchema.parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Certificate not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "certificates.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  await adminDb().collection(COLLECTION).doc(params.id).delete();
  return json({ ok: true });
}
