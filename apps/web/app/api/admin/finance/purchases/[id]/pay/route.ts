import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { purchasePaySchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

// POST /api/admin/finance/purchases/[id]/pay — pay a vendor bill (full or partial).
// Also logs the payment as an approved expense so it flows into P&L / ledger.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.approve");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { amount, method } = purchasePaySchema.parse(await req.json());
    const db = adminDb();
    const ref = db.collection("purchases").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Purchase not found" }, { status: 404 });

    const p = snap.data() as { amount: number; amountPaid: number; vendorName?: string };
    const newPaid = (p.amountPaid || 0) + amount;
    if (newPaid > p.amount) return NextResponse.json({ ok: false, error: "Payment exceeds bill amount" }, { status: 400 });
    const status = newPaid >= p.amount ? "paid" : "partial";
    const now = FieldValue.serverTimestamp();

    const batch = db.batch();
    batch.update(ref, { amountPaid: newPaid, status, updatedAt: now });
    // record as an approved expense (so it appears in P&L / ledger)
    const expRef = db.collection("expenses").doc();
    batch.set(expRef, {
      category: "vendor",
      amount,
      date: new Date().toISOString().slice(0, 10),
      description: `Vendor payment · ${p.vendorName || ""} (bill ${params.id})`,
      paymentMethod: method,
      status: "approved",
      approvedBy: token.uid,
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    });
    await batch.commit();

    return NextResponse.json({ ok: true, amountPaid: newPaid, status });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to record payment" }, { status: 400 });
  }
}
