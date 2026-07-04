import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { inventorySaleSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "inventory_sales";

export async function GET(req: Request) {
  const token = await requirePermission(req, "inventory.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(500).get();
  const sales = snap.docs.map((d) => serializeDoc(d)).sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return NextResponse.json({ ok: true, sales });
}

// POST — record a sale (decrements stock; amount = qty × unitPrice).
export async function POST(req: Request) {
  const token = await requirePermission(req, "inventory.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = inventorySaleSchema.parse(await req.json());
    const db = adminDb();
    const itemRef = db.collection("inventory_items").doc(parsed.itemId);
    const item = await itemRef.get();
    if (!item.exists) return NextResponse.json({ ok: false, error: "Item not found" }, { status: 404 });
    const it = item.data() as { name: string; stock: number; unitPrice: number };
    if ((it.stock || 0) < parsed.qty) return NextResponse.json({ ok: false, error: "Not enough stock" }, { status: 400 });

    const amount = parsed.qty * (it.unitPrice || 0);
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.update(itemRef, { stock: it.stock - parsed.qty, updatedAt: now });
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, { ...parsed, itemName: it.name, amount, date: parsed.date || new Date().toISOString().slice(0, 10), createdBy: token.uid, createdAt: now });
    await batch.commit();
    return NextResponse.json({ ok: true, id: ref.id, amount });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
