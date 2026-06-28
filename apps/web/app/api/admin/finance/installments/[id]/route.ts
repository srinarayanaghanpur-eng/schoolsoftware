import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

const COLLECTION = "installment_plans";
type Installment = { number: number; amount: number; dueDate: string; status: string; paidDate?: string; paymentId?: string };

// GET /api/admin/finance/installments/[id]
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection(COLLECTION).doc(params.id).get();
  if (!snap.exists) return NextResponse.json({ ok: false, error: "Installment plan not found" }, { status: 404 });

  return NextResponse.json({ ok: true, plan: { id: snap.id, ...snap.data() } });
}

// PATCH /api/admin/finance/installments/[id] — mark an installment as paid.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Installment plan not found" }, { status: 404 });

    const plan = snap.data()!;
    const installments: Installment[] = (plan.installments as Installment[]) || [];
    const installmentNumber = body.installmentNumber;
    const paidDate = body.paidDate || new Date().toISOString().slice(0, 10);

    if (typeof installmentNumber !== "number") {
      return NextResponse.json({ ok: false, error: "installmentNumber is required" }, { status: 400 });
    }

    const idx = installments.findIndex((i) => i.number === installmentNumber);
    if (idx === -1) return NextResponse.json({ ok: false, error: "Installment not found" }, { status: 404 });
    if (installments[idx].status === "paid") return NextResponse.json({ ok: false, error: "Installment already paid" }, { status: 400 });

    installments[idx].status = "paid";
    installments[idx].paidDate = paidDate;

    const paidAmount = installments
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amount, 0);

    await ref.update({
      installments,
      paidAmount,
      updatedAt: FieldValue.serverTimestamp()
    });

    return NextResponse.json({ ok: true, paidAmount, installmentNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update installment";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
