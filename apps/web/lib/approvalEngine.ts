import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
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

  await docRef.set(request);

  await writeAuditLog({
    action: "approval.created",
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.requestedBy,
    actorRole: "admin",
    newValues: request as unknown as Record<string, unknown>,
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
  const db = adminDb();
  const ref = db.collection("approval_requests").doc(params.approvalId);
  const snap = await ref.get();

  if (!snap.exists) {
    throw new Error("Approval request not found");
  }

  const existing = snap.data() as ApprovalRequest;

  if (existing.status !== "pending") {
    throw new Error(`Approval request is already ${existing.status}`);
  }

  const now = new Date().toISOString();
  await ref.update({
    status: params.status,
    reviewedBy: params.reviewedBy,
    reviewedByName: params.reviewedByName,
    reviewedAt: now,
    notes: params.notes ?? ""
  });

  await writeAuditLog({
    action: params.status === "approved" ? "approval.approved" : "approval.rejected",
    entityType: existing.entityType,
    entityId: existing.entityId,
    actorId: params.reviewedBy,
    actorRole: "admin",
    oldValues: { status: existing.status },
    newValues: { status: params.status, notes: params.notes },
    reason: params.notes,
    approvalId: params.approvalId,
    branch: existing.branch,
    academicYearId: existing.academicYearId
  });

  // Apply the real side-effect once a request is decided.
  await applyApprovalEffect(existing, params.status);
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
        // Reverse the student's running paid total.
        const studentId = (payment.studentId as string) || (request.payload?.studentId as string);
        const amount = Number(payment.amountPaid ?? request.payload?.amount ?? 0);
        if (studentId && amount > 0) {
          await db.collection("students").doc(studentId).set(
            { totalFeesPaid: FieldValue.increment(-amount), feeLastUpdated: new Date() },
            { merge: true }
          );
        }
      } else {
        // Rejected → restore the payment to completed.
        await payRef.update({ status: "completed", cancellationReason: FieldValue.delete() });
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
  const snapshot = await adminDb()
    .collection("approval_requests")
    .where("status", "==", "pending")
    .count()
    .get();

  return snapshot.data().count;
}
