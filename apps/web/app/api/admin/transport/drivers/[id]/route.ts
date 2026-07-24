import { FieldValue } from "firebase-admin/firestore";
import { driverUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

const COLLECTION = "drivers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const { id } = await params;
    const parsed = driverUpdateSchema.parse(await req.json());
    const update: Record<string, unknown> = { ...parsed, updatedAt: FieldValue.serverTimestamp() };
    if (parsed.salary === undefined) update.salary = null;
    await adminDb().collection(COLLECTION).doc(id).update(update);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const { id } = await params;
    await adminDb().collection(COLLECTION).doc(id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

