import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, json } from "@/lib/apiUtils";

// DELETE /api/admin/holidays/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const decodedToken = await requireAdmin(req);
  if (!decodedToken) return json({ ok: false, error: "Admin access required" }, { status: 403 });
  try {
    const ref = adminDb().collection("holidays").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Holiday not found" }, { status: 404 });
    await ref.delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
