import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

// GET /api/admin/inventory/movements — recent stock-in / stock-out log.
export async function GET(req: Request) {
  const token = await requirePermission(req, "inventory.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection("inventory_movements").orderBy("createdAt", "desc").limit(100).get();
  return json({ ok: true, movements: snap.docs.map((d) => serializeDoc(d)) });
}
