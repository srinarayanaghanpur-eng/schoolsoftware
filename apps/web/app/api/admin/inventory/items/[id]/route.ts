import { FieldValue } from "firebase-admin/firestore";
import { inventoryItemUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// PUT /api/admin/inventory/items/[id] — edit item details (stock changes go through /stock).
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "inventory.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = inventoryItemUpdateSchema.parse(await req.json());
    const ref = adminDb().collection("inventory_items").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Item not found" }, { status: 404 });
    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

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
