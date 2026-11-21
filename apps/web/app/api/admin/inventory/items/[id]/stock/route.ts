import { FieldValue } from "firebase-admin/firestore";
import { inventoryStockAdjustSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// POST /api/admin/inventory/items/[id]/stock — add/remove stock and keep a movement log.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "inventory.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = inventoryStockAdjustSchema.parse(await req.json());
    const db = adminDb();
    const ref = db.collection("inventory_items").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Item not found" }, { status: 404 });
    const item = snap.data() as { name?: string; stock?: number; unitPrice?: number };
    const next = (item.stock || 0) + parsed.delta;
    if (next < 0) return json({ ok: false, error: "Stock cannot go negative" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.update(ref, { stock: next, updatedAt: now });
    const movementRef = db.collection("inventory_movements").doc();
    batch.set(movementRef, {
      itemId: params.id,
      itemName: item.name || "",
      delta: parsed.delta,
      reason: parsed.reason || (parsed.delta > 0 ? "Stock in" : "Stock out"),
      balanceAfter: next,
      unitPrice: item.unitPrice || 0,
      createdBy: token.uid,
      createdAt: now
    });
    await batch.commit();
    return json({ ok: true, stock: next, id: movementRef.id });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
