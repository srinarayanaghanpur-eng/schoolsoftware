import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// DELETE /api/admin/inventory/items/[id]
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(_req, "inventory.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const ref = adminDb().collection("inventory_items").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Item not found" }, { status: 404 });
    await ref.delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
