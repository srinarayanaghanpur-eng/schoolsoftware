import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";

const COLLECTION = "subject_assignments";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission(req, "academics.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    await adminDb().collection(COLLECTION).doc(params.id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to remove assignment") }, { status: 500 });
  }
}
