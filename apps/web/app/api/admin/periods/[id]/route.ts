import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission } from "@/lib/apiUtils";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requirePermission(req, "academics.edit");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    await adminDb().collection("periods").doc(params.id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to delete period") }, { status: 500 });
  }
}
