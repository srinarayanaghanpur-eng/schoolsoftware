import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { paymentOrderSchema } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";

// POST /api/fees/order — create an online payment order for a student.
// Provider is a stub ("manual"): a real gateway (Razorpay/UPI) would create its order
// here and return its order id + key. The order is recorded so confirm can finalize it.
export async function POST(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });

  try {
    const parsed = paymentOrderSchema.parse(await req.json());
    const db = adminDb();

    const student = await db.collection("students").doc(parsed.studentId).get();
    if (!student.exists) return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });

    const now = FieldValue.serverTimestamp();
    const providerOrderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ref = await db.collection("payment_orders").add({
      studentId: parsed.studentId,
      amount: parsed.amount,
      paymentType: parsed.paymentType,
      feeType: parsed.paymentType,
      note: parsed.note,
      status: "created",
      provider: "manual",
      providerOrderId,
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    });

    // A real integration returns { gatewayKey, providerOrderId } for the client SDK.
    return NextResponse.json({ ok: true, orderId: ref.id, providerOrderId, amount: parsed.amount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create payment order";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
