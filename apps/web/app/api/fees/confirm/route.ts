import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { paymentConfirmSchema } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";

// POST /api/fees/confirm — finalize a payment order: mark paid, record the payment,
// and update the student's fee totals. (A real gateway would verify a signature here.)
export async function POST(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  try {
    const parsed = paymentConfirmSchema.parse(await req.json());
    const db = adminDb();
    const orderRef = db.collection("payment_orders").doc(parsed.orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const order = orderSnap.data() as { studentId: string; amount: number; paymentType: string; status: string };
    if (order.status === "paid") return NextResponse.json({ ok: false, error: "Order already paid" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const studentRef = db.collection("students").doc(order.studentId);

    const batch = db.batch();
    // 1) record the payment (same `payments` collection the admin uses)
    const paymentRef = db.collection("payments").doc();
    batch.set(paymentRef, {
      studentId: order.studentId,
      amountPaid: order.amount,
      paymentType: order.paymentType,
      paymentMethod: parsed.method || "cash",
      transactionId: parsed.transactionId || orderSnap.id,
      status: "completed",
      source: "online",
      paidBy: token.uid,
      paidByName: token.name ?? token.uid,
      createdAt: now
    });
    // 2) update the student's running paid total atomically
    batch.set(studentRef, { totalFeesPaid: FieldValue.increment(order.amount), feeLastUpdated: now }, { merge: true });
    // 3) close the order
    batch.update(orderRef, { status: "paid", updatedAt: now });
    await batch.commit();

    return NextResponse.json({ ok: true, receiptId: paymentRef.id, amount: order.amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to confirm payment";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
