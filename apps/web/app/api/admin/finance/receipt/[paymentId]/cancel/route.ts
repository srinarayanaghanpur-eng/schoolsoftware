import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { createApprovalRequest } from "@/lib/approvalEngine";
import { writeAuditLog } from "@/lib/auditLog";

// POST /api/admin/finance/receipt/[paymentId]/cancel
// Creates an approval request to cancel a receipt.
// On approval (handled separately), the receipt status is updated and student balance reversed.
export async function POST(req: Request, { params }: { params: { paymentId: string } }) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { reason } = await req.json();
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return json({ ok: false, error: "Cancellation reason is required" }, { status: 400 });
    }

    const db = adminDb();
    const paySnap = await db.collection("payments").doc(params.paymentId).get();
    if (!paySnap.exists) {
      return json({ ok: false, error: "Payment not found" }, { status: 404 });
    }

    const payment = paySnap.data() as Record<string, unknown>;
    if (payment.status === "cancelled") {
      return json({ ok: false, error: "Payment is already cancelled" }, { status: 400 });
    }

    // Store cancellation reason on payment
    await db.collection("payments").doc(params.paymentId).update({
      cancellationReason: reason.trim(),
      cancellationRequestedBy: token.uid,
      cancellationRequestedAt: new Date().toISOString(),
      status: "cancellation_requested",
    });

    // Create approval request
    const approvalId = await createApprovalRequest({
      requestType: "receipt_cancel",
      entityType: "payment",
      entityId: params.paymentId,
      title: `Cancel receipt for payment ${params.paymentId}`,
      description: reason.trim(),
      requestedBy: token.uid,
      requestedByName: token.name || token.uid,
      payload: {
        paymentId: params.paymentId,
        amount: payment.amountPaid,
        studentId: payment.studentId,
        reason: reason.trim(),
      },
    });

    await writeAuditLog({
      action: "receipt.cancelled",
      entityType: "payment",
      entityId: params.paymentId,
      actorId: token.uid,
      actorRole: token.role || "admin",
      oldValues: { status: payment.status },
      newValues: { status: "cancellation_requested", cancellationReason: reason.trim() },
      reason: reason.trim(),
      approvalId,
    });

    return json({
      ok: true,
      approvalId,
      message: "Cancellation request submitted for approval.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process cancellation request";
    return json({ ok: false, error: message }, { status: 500 });
  }
}

