import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { removeUndefinedFields } from "@/lib/firestoreSanitize";
import { writeAuditLog } from "@/lib/auditLog";
import type { ApprovalRequest, ApprovalStatus } from "@sri-narayana/shared";

type CreateApprovalParams = {
  requestType: string;
  entityType: string;
  entityId: string;
  title: string;
  description?: string;
  requestedBy: string;
  requestedByName?: string;
  payload?: Record<string, unknown>;
  branch?: string;
  academicYearId?: string;
};

export async function createApprovalRequest(params: CreateApprovalParams): Promise<string> {
  const db = adminDb();
  const docRef = db.collection("approval_requests").doc();
  const now = new Date().toISOString();

  const request: ApprovalRequest = {
    requestType: params.requestType,
    entityType: params.entityType,
    entityId: params.entityId,
    title: params.title,
    description: params.description,
    requestedBy: params.requestedBy,
    requestedByName: params.requestedByName,
    requestedAt: now,
    status: "pending",
    payload: params.payload,
    branch: params.branch,
    academicYearId: params.academicYearId
  };

  // Firestore rejects `undefined` field values, so omit any that weren't provided
  // (e.g. the receipt-cancel flow doesn't set branch/academicYearId).
  const cleanRequest = removeUndefinedFields(request);

  await docRef.set(cleanRequest);

  await writeAuditLog({
    action: "approval.created",
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.requestedBy,
    actorRole: "admin",
    newValues: cleanRequest as unknown as Record<string, unknown>,
    approvalId: docRef.id,
    branch: params.branch,
    academicYearId: params.academicYearId
  });

  return docRef.id;
}

type ReviewApprovalParams = {
  approvalId: string;
  status: ApprovalStatus;
  notes?: string;
  reviewedBy: string;
  reviewedByName?: string;
};

export async function reviewApprovalRequest(params: ReviewApprovalParams): Promise<void> {
  if (params.status === "pending") {
    throw new Error("Invalid approval status");
  }
  const db = adminDb();
  const ref = db.collection("approval_requests").doc(params.approvalId);

  const now = new Date().toISOString();
  let existing: ApprovalRequest;

  // Atomic pending→decided transition. Without the transaction two concurrent
  // reviewers could both pass the pending check and BOTH run
  // applyApprovalEffect — double-applying side effects (e.g. a receipt cancel
  // decrementing financeSummaries twice). Firestore transactions serialize on
  // the doc, so only the first reviewer wins; the loser gets
  // "already {status}" and applies nothing.
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists) {
      throw new Error("Approval request not found");
    }
    const data = snap.data() as ApprovalRequest;
    if (data.status !== "pending") {
      throw new Error(`Approval request is already ${data.status}`);
    }
    existing = data;
    transaction.update(ref, {
      status: params.status,
      reviewedBy: params.reviewedBy,
      reviewedByName: params.reviewedByName,
      reviewedAt: now,
      notes: params.notes ?? ""
    });
  });

  const reviewed = existing!;

  await writeAuditLog({
    action: params.status === "approved" ? "approval.approved" : "approval.rejected",
    entityType: reviewed.entityType,
    entityId: reviewed.entityId,
    actorId: params.reviewedBy,
    actorRole: "admin",
    oldValues: { status: reviewed.status },
    newValues: { status: params.status, notes: params.notes },
    reason: params.notes,
    approvalId: params.approvalId,
    branch: reviewed.branch,
    academicYearId: reviewed.academicYearId
  });

  // Apply the real side-effect once a request is decided — only reached by
  // the single transaction winner.
  await applyApprovalEffect(reviewed, params.status);
}

/**
 * Performs the concrete action tied to an approval request after it is decided.
 * Only handles request types whose effect isn't already applied elsewhere.
 */
async function applyApprovalEffect(request: ApprovalRequest, status: ApprovalStatus): Promise<void> {
  const db = adminDb();

  switch (request.requestType) {
    case "admission": {
      // Activate (or reject) the student admission.
      await db.collection("students").doc(request.entityId).set(
        {
          admissionStatus: status === "approved" ? "approved" : "rejected",
          updatedAt: new Date()
        },
        { merge: true }
      );
      break;
    }
    case "receipt_cancel": {
      // The cancel route only flags the payment "cancellation_requested";
      // the real effect happens here once an admin decides.
      const paymentId = request.entityId;
      const payRef = db.collection("payments").doc(paymentId);
      const paySnap = await payRef.get();
      if (!paySnap.exists) break;
      const payment = paySnap.data() as Record<string, unknown>;

      if (status === "approved") {
        await payRef.update({ status: "cancelled", cancelledAt: new Date().toISOString() });
        // Cancelled receipts must disappear from lists/print automatically —
        // stamp every receipt issued for this payment as cancelled.
        const receiptSnap = await db.collection("receipts").where("paymentId", "==", paymentId).get().catch(() => null);
        if (receiptSnap && !receiptSnap.empty) {
          const receiptBatch = db.batch();
          receiptSnap.docs.forEach((d) => {
            receiptBatch.set(d.ref, { status: "cancelled", cancelledAt: new Date().toISOString() }, { merge: true });
          });
          await receiptBatch.commit().catch(() => undefined);
        }
        // Reverse the monthly rollup written at payment time, so financeSummaries
        // never stays inflated for a cancelled receipt. The summary doc id is
        // {branchId}_{academicYearId}_{YYYY-MM} of the original payment month.
        const cancelledAmount = Number(payment.amountPaid || 0);
        if (cancelledAmount > 0) {
          const rawDate = payment.createdAt ?? payment.paymentDate ?? null;
          const paidAt =
            rawDate && typeof (rawDate as { toDate?: unknown }).toDate === "function"
              ? (rawDate as { toDate: () => Date }).toDate()
              : rawDate
                ? new Date(String(rawDate))
                : new Date();
          const paidTime = Number.isNaN(paidAt.getTime()) ? new Date() : paidAt;
          const cancelMonthKey = `${paidTime.getFullYear()}-${String(paidTime.getMonth() + 1).padStart(2, "0")}`;
          const branchId = String(payment.branchId || "default-branch");
          const yearId = String(payment.academicYearId || "default");
          await db.collection("financeSummaries").doc(`${branchId}_${yearId}_${cancelMonthKey}`).set(
            {
              branchId,
              academicYearId: yearId,
              month: cancelMonthKey,
              totalIncome: FieldValue.increment(-cancelledAmount),
              totalReceipts: FieldValue.increment(-1),
              updatedAt: new Date()
            },
            { merge: true }
          );
        }
        // Recompute the student's fee state from remaining completed payments.
        // This restores totalFeesPaid, totalFeesDue, feeStatus AND the
        // studentFeeSummaries read-model in one canonical pass (the previous
        // implementation only decremented totalFeesPaid, leaving dues/status/
        // summaries stale after a cancellation).
        const studentId = (payment.studentId as string) || (request.payload?.studentId as string);
        if (studentId) {
          const { recalculateStudentFeeSummary } = await import("@/lib/feeRecalculation");
          const { markSummaryDirty } = await import("@/lib/markSummaryDirty");
          await recalculateStudentFeeSummary(studentId, String(payment.academicYearId ?? ""));
          await markSummaryDirty("receipt_cancel");
        }
      } else {
        // Rejected → restore the payment to completed.
        await payRef.update({ status: "completed", cancellationReason: FieldValue.delete() });
      }
      break;
    }
    case "promotion": {
      // Class promotion / demotion applies ONLY here, on super-admin approve.
      // The POST route only stages pending records — students keep their old
      // class until this effect runs. On reject, records close as rejected.
      const payload = (request.payload ?? {}) as Record<string, unknown>;
      const promotionIds = Array.isArray(payload.promotionIds)
        ? (payload.promotionIds as string[])
        : String(request.entityId || "").split(",").map((s) => s.trim()).filter(Boolean);
      const now = new Date();
      const batch = db.batch();
      let touched = 0;
      const targetIds = promotionIds.slice(0, 500);

      // Bulk-read promotions (and only the students whose fee balance must be
      // carried forward) instead of one round-trip per record.
      const promotionRefs = targetIds.map((id) => db.collection("promotions").doc(id));
      const promotionSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
      for (let i = 0; i < promotionRefs.length; i += 100) {
        promotionSnaps.push(...(await db.getAll(...promotionRefs.slice(i, i + 100))));
      }

      const studentSnapsById = new Map<string, FirebaseFirestore.DocumentSnapshot>();
      if (status === "approved") {
        const studentRefs: FirebaseFirestore.DocumentReference[] = [];
        for (const snap of promotionSnaps) {
          if (!snap.exists) continue;
          const promo = snap.data() as Record<string, unknown>;
          const studentId = String(promo.studentId || "");
          if (studentId && promo.feeBalanceCarriedForward) {
            studentRefs.push(db.collection("students").doc(studentId));
          }
        }
        const uniqueRefs = [...new Map(studentRefs.map((ref) => [ref.id, ref])).values()];
        for (let i = 0; i < uniqueRefs.length; i += 100) {
          const snaps = await db.getAll(...uniqueRefs.slice(i, i + 100));
          for (const snap of snaps) studentSnapsById.set(snap.id, snap);
        }
      }

      for (let idx = 0; idx < promotionSnaps.length; idx++) {
        const promoSnap = promotionSnaps[idx];
        if (!promoSnap.exists) continue;
        const promo = promoSnap.data() as Record<string, unknown>;
        if (status === "approved") {
          const studentId = String(promo.studentId || "");
          if (studentId) {
            const updateData: Record<string, unknown> = {
              class: promo.toClass,
              section: promo.toSection,
              academicYearId: promo.academicYearId,
              updatedAt: now
            };
            if (promo.feeBalanceCarriedForward) {
              const student = (studentSnapsById.get(studentId)?.data() ?? {}) as Record<string, unknown>;
              const existingDue = Number(student.totalFeesDue || 0);
              const existingPaid = Number(student.totalFeesPaid || 0);
              updateData.totalFeesDue = existingDue;
              updateData.totalFeesPaid = existingPaid;
              updateData.feeStatus = existingDue <= 0 ? "paid" : existingPaid > 0 ? "partial" : "pending";
            }
            batch.update(db.collection("students").doc(studentId), updateData);
            touched++;
          }
          batch.update(db.collection("promotions").doc(promoSnap.id), { status: "completed", updatedAt: now });
        } else {
          batch.update(db.collection("promotions").doc(promoSnap.id), { status: "rejected", updatedAt: now });
        }
      }
      await batch.commit();
      if (touched > 0) {
        const { markSummaryDirty } = await import("@/lib/markSummaryDirty");
        await markSummaryDirty("promotion");
      }
      break;
    }
    case "profile_update": {
      // Parent/student profile update: write the new mobile/address to the doc.
      if (status === "approved") {
        const payload = request.payload ?? {};
        const entityType = request.entityType; // "parent" or "student"
        const collection = entityType === "student" ? "students" : "users";
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (payload.mobile) updateData.phone = payload.mobile;
        if (payload.address) updateData.address = payload.address;
        if (payload.email) updateData.email = payload.email;
        await db.collection(collection).doc(request.entityId).set(updateData, { merge: true });
      }
      // On reject, no-op — the request is simply closed.
      break;
    }
    default:
      // Other request types apply their effect in their own flow.
      break;
  }
}

export async function getApprovalRequests(options: {
  status?: ApprovalStatus;
  requestType?: string;
  requestedBy?: string;
  limit?: number;
} = {}): Promise<ApprovalRequest[]> {
  let query: FirebaseFirestore.Query = adminDb().collection("approval_requests");

  if (options.status) query = query.where("status", "==", options.status);
  if (options.requestType) query = query.where("requestType", "==", options.requestType);
  if (options.requestedBy) query = query.where("requestedBy", "==", options.requestedBy);

  const snapshot = await query
    .orderBy("requestedAt", "desc")
    .limit(options.limit ?? 100)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ApprovalRequest));
}

export async function getPendingApprovalCount(): Promise<number> {
  return getApprovalRequestCount({ status: "pending" });
}

export async function getApprovalRequestCount(options: {
  status?: ApprovalStatus;
  requestType?: string;
  requestedBy?: string;
} = {}): Promise<number> {
  let query: FirebaseFirestore.Query = adminDb().collection("approval_requests");

  if (options.status) query = query.where("status", "==", options.status);
  if (options.requestType) query = query.where("requestType", "==", options.requestType);
  if (options.requestedBy) query = query.where("requestedBy", "==", options.requestedBy);

  const snapshot = await query.count().get();

  return snapshot.data().count;
}
