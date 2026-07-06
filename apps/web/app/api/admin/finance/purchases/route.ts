import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { purchaseCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "purchases";

// GET /api/admin/finance/purchases?vendorId=&status=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
  const vendorId = searchParams.get("vendorId");
  const status = searchParams.get("status");
  if (vendorId) query = query.where("vendorId", "==", vendorId);
  else if (status) query = query.where("status", "==", status);
  // Hard read cap to keep query cost bounded (Firestore free-tier quota).
  const snap = await query.limit(500).get();
  const purchases = snap.docs
    .map((d) => serializeDoc(d))
    .filter((purchase) => (!vendorId || purchase.vendorId === vendorId) && (!status || purchase.status === status))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return NextResponse.json({ ok: true, purchases });
}

// POST /api/admin/finance/purchases — record a vendor bill (payable).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = purchaseCreateSchema.parse(await req.json());
    const db = adminDb();
    const vendor = await db.collection("vendors").doc(parsed.vendorId).get();
    const items = parsed.items.map((it) => ({ ...it, amount: it.qty * it.rate }));
    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      ...parsed,
      items,
      vendorName: (vendor.data()?.name as string) || "",
      amountPaid: 0,
      status: "unpaid",
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to record purchase" }, { status: 400 });
  }
}
