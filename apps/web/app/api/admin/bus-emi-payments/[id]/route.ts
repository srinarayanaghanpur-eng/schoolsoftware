import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { BUS_EMI_PAYMENTS_COLLECTION, derivePaymentStatus, recalcFinanceSummary } from "@/lib/busFinanceService";

const VALID_MODES = new Set(["cash", "bank_transfer", "upi", "cheque", "other"]);
const VALID_STATUS = new Set(["pending", "paid", "partial", "overdue"]);

/**
 * PATCH /api/admin/bus-emi-payments/[id]
 * Record/adjust a single EMI payment (mark paid / partial / pending). The
 * payment status is derived from the amounts + due date unless an explicit
 * valid `status` is supplied. After updating, the parent finance summary is
 * recomputed (paid/pending counts, auto-close, overdue).
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const db = adminDb();
    const ref = db.collection(BUS_EMI_PAYMENTS_COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "EMI record not found" }, { status: 404 });

    const existing = snap.data() as Record<string, unknown>;
    const body = await req.json();

    const paidAmount = body.paidAmount !== undefined ? Number(body.paidAmount) || 0 : Number(existing.paidAmount) || 0;
    const emiAmount = Number(existing.emiAmount) || 0;
    const dueDate = String(existing.dueDate ?? "");

    const update: Record<string, unknown> = {
      paidAmount,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.paymentDate !== undefined) update.paymentDate = body.paymentDate ? String(body.paymentDate) : null;
    if (body.paymentMode !== undefined) {
      if (body.paymentMode && !VALID_MODES.has(String(body.paymentMode))) {
        return NextResponse.json({ ok: false, error: "Invalid payment mode" }, { status: 400 });
      }
      update.paymentMode = body.paymentMode || null;
    }
    if (body.transactionId !== undefined) update.transactionId = body.transactionId ? String(body.transactionId) : null;
    if (body.proofUrl !== undefined) update.proofUrl = body.proofUrl ? String(body.proofUrl) : null;
    if (body.lateFee !== undefined) update.lateFee = Number(body.lateFee) || 0;
    if (body.remarks !== undefined) update.remarks = body.remarks ? String(body.remarks) : "";

    // Explicit status wins if valid; otherwise derive it.
    if (body.status !== undefined && VALID_STATUS.has(String(body.status))) {
      update.status = String(body.status);
    } else {
      update.status = derivePaymentStatus(paidAmount, emiAmount, dueDate);
    }
    // Default the payment date to today when a payment is recorded without one.
    if ((update.status === "paid" || update.status === "partial") && !update.paymentDate && !existing.paymentDate) {
      update.paymentDate = new Date().toISOString().slice(0, 10);
    }

    await ref.update(update);
    await recalcFinanceSummary(String(existing.busFinanceId));

    const fresh = await ref.get();
    return NextResponse.json({ ok: true, payment: { id: fresh.id, ...fresh.data() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update EMI payment";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/bus-emi-payments/[id]
 * Delete an EMI payment row (admin-only). Recomputes the parent summary.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.delete");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const db = adminDb();
    const ref = db.collection(BUS_EMI_PAYMENTS_COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "EMI record not found" }, { status: 404 });

    const busFinanceId = String((snap.data() as Record<string, unknown>).busFinanceId);
    await ref.delete();
    await recalcFinanceSummary(busFinanceId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete EMI payment";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
