import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";
import { feeFineRuleUpdateSchema } from "@/lib/feeFineRules";

const COLLECTION = "fee_fine_rules";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission(req, "fees.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = feeFineRuleUpdateSchema.parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) return json({ ok: false, error: "Not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to update fine rule") }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission(req, "fees.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    await adminDb().collection(COLLECTION).doc(params.id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to delete fine rule") }, { status: 500 });
  }
}
