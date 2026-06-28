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
