import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
import { BUS_EMI_PAYMENTS_COLLECTION, BUS_FINANCE_COLLECTION, derivePaymentStatus, recalcFinanceSummary } from "@/lib/busFinanceService";

const VALID_MODES = new Set(["cash", "upi", "bank_transfer", "cheque", "auto_debit", "other"]);

/**
 * Records or adjusts an EMI and its linked expense in one Firestore transaction.
 * The deterministic expense id makes retries idempotent and prevents duplicate
 * Finance entries for the same EMI month.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const paidAmount = Number(body.paidAmount);
    const lateFee = Number(body.lateFee) || 0;
    const paymentMode = String(body.paymentMode || "");
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
      return json({ ok: false, error: "Amount being paid must be greater than zero" }, { status: 400 });
    }
    if (!VALID_MODES.has(paymentMode)) {
      return json({ ok: false, error: "Select a valid payment mode" }, { status: 400 });
    }

    const db = adminDb();
    const paymentRef = db.collection(BUS_EMI_PAYMENTS_COLLECTION).doc(params.id);
    const expenseRef = db.collection("expenses").doc(`bus-emi-${params.id}`);
    const auditRef = db.collection("bus_finance_audit_logs").doc();

    await db.runTransaction(async (transaction) => {
      const paymentSnap = await transaction.get(paymentRef);
      if (!paymentSnap.exists) throw new Error("EMI record not found");
      const existing = paymentSnap.data() as Record<string, unknown>;
      const financeRef = db.collection(BUS_FINANCE_COLLECTION).doc(String(existing.busFinanceId));
      const financeSnap = await transaction.get(financeRef);
      if (!financeSnap.exists) throw new Error("Bus loan not found");
      const finance = financeSnap.data() as Record<string, unknown>;

      if (["completed", "closed"].includes(String(finance.status))) {
        throw new Error("Completed or closed loans cannot accept payments");
      }
      if (String(existing.status) === "paid" && !body.auditNote) {
        throw new Error("This EMI month is already paid. An audit note is required to adjust it");
      }

      const emiAmount = Number(existing.emiAmount) || 0;
      const previousPaid = Number(existing.paidAmount) || 0;
      const maximum = Math.max(0, emiAmount - previousPaid);
      if (paidAmount > maximum && !body.confirmOverpayment) {
        throw new Error(`Payment exceeds the allowable outstanding amount of ₹${maximum.toLocaleString("en-IN")}`);
      }

      const totalPaid = Math.min(emiAmount, previousPaid + paidAmount);
      const principalScheduled = Number(existing.principalComponent) || emiAmount;
      const interestScheduled = Number(existing.interestComponent) || 0;
      const principalComponent = body.principalComponent === undefined
        ? Math.min(principalScheduled, totalPaid)
        : Math.max(0, Number(body.principalComponent) || 0);
      const interestComponent = body.interestComponent === undefined
        ? Math.min(interestScheduled, Math.max(0, totalPaid - principalComponent))
        : Math.max(0, Number(body.interestComponent) || 0);
      if (principalComponent + interestComponent > totalPaid) {
        throw new Error("Principal and interest components cannot exceed the paid amount");
      }

      const now = FieldValue.serverTimestamp();
      const paymentDate = String(body.paymentDate || new Date().toISOString().slice(0, 10));
      const status = derivePaymentStatus(totalPaid, emiAmount, String(existing.dueDate || ""));
      const expenseAmount = totalPaid + lateFee;
      const paymentUpdate = {
        paidAmount: totalPaid,
        paymentDate,
        paymentMode,
        bankAccount: String(body.bankAccount || ""),
        transactionId: String(body.transactionId || ""),
        proofUrl: String(body.proofUrl || existing.proofUrl || ""),
        lateFee,
        principalComponent,
        interestComponent,
        remarks: String(body.remarks || ""),
        status,
        expenseId: expenseRef.id,
        createdBy: existing.createdBy || token.uid,
        paidAt: now,
        updatedAt: now,
      };
      transaction.update(paymentRef, paymentUpdate);
      transaction.set(expenseRef, {
        schoolId: finance.schoolId || "",
        academicYearId: finance.academicYearId || "",
        category: "Vehicle Loan / Bus EMI",
        description: `${finance.vehicleNumber} • ${finance.financeCompany} • EMI ${existing.emiMonth}`,
        amount: expenseAmount,
        date: paymentDate,
        status: "approved",
        source: "bus_emi",
        sourceId: params.id,
        busFinanceId: existing.busFinanceId,
        busRegistrationNumber: finance.vehicleNumber,
        financeCompany: finance.financeCompany,
        emiMonth: existing.emiMonth,
        principalAmount: principalComponent,
        interestAmount: interestComponent,
        lateFee,
        paymentMode,
        referenceNumber: String(body.transactionId || ""),
        approvedBy: token.uid,
        createdBy: token.uid,
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
      transaction.set(auditRef, {
        busFinanceId: existing.busFinanceId,
        paymentId: params.id,
        action: previousPaid > 0 ? "payment_adjusted" : "payment_recorded",
        before: { paidAmount: previousPaid, status: existing.status || "" },
        after: { paidAmount: totalPaid, status, expenseId: expenseRef.id },
        reason: String(body.auditNote || body.remarks || "EMI payment recorded"),
        createdBy: token.uid,
        createdAt: now,
      });
    });

    const paymentSnap = await paymentRef.get();
    const busFinanceId = String((paymentSnap.data() as Record<string, unknown>).busFinanceId);
    await recalcFinanceSummary(busFinanceId);
    return json({ ok: true, payment: { id: paymentSnap.id, ...paymentSnap.data() }, expenseId: expenseRef.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record EMI payment";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (!String(body.auditReason || "").trim()) {
    return json({ ok: false, error: "An audit reason is required" }, { status: 400 });
  }
  return json({ ok: false, error: "EMI schedule rows cannot be deleted after creation; waive or adjust the installment instead" }, { status: 409 });
}
