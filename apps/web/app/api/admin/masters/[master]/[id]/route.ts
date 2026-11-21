import { FieldValue } from "firebase-admin/firestore";
import type { Permission } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { getMasterConfig } from "@/lib/masterConfig";
import { buildMasterSchema } from "@/lib/masterSchema";

export async function PATCH(req: Request, { params }: { params: { master: string; id: string } }) {
  const config = getMasterConfig(params.master);
  if (!config) return json({ ok: false, error: "Unknown master" }, { status: 404 });

  const auth = await requirePermission(req, `${config.module}.edit` as Permission);
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = buildMasterSchema(config).partial().parse(await req.json());
    const ref = adminDb().collection(config.collection).doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to update record") }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { master: string; id: string } }) {
  const config = getMasterConfig(params.master);
  if (!config) return json({ ok: false, error: "Unknown master" }, { status: 404 });

  const auth = await requirePermission(req, `${config.module}.edit` as Permission);
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    await adminDb().collection(config.collection).doc(params.id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to delete record") }, { status: 500 });
  }
}
