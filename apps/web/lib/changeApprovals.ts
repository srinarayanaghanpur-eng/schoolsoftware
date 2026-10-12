import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendPushToUsers } from "@/lib/push/sendPush";
import { roleHasPermission } from "@/lib/rbacAdmin";
import type { Permission, Role } from "@sri-narayana/shared";
import { markSummaryDirty } from "@/lib/markSummaryDirty";
import { recalculateStudentFeeSummary } from "@/lib/feeRecalculation";
import { writeAuditLog } from "@/lib/auditLog";

const COLLECTION = "approvals";

/** Roles that may approve or reject change requests. */
export const APPROVER_ROLES = ["principal", "super_admin", "admin"] as const;
export type ApproverRole = (typeof APPROVER_ROLES)[number];

export function isApproverRole(role: unknown): role is ApproverRole {
  return typeof role === "string" && (APPROVER_ROLES as readonly string[]).includes(role);
}

/** Entities whose edits/deletes can go through approval. Collection allowlist. */
const APPLY_TARGETS: Record<string, string> = {
  student: "students",
  fee_structure: "fee_structures",
  expense: "expenses",
  exam: "exams"
};

export type ChangeAction = "edit" | "delete";

export type ChangeRequest = {
  id: string;
  entity: string;
  entityId: string;
  action: ChangeAction;
  /** Field patch for edits (delete ignores it). */
  patch: Record<string, string | number | boolean | null | unknown[]>;
  note?: string;
  status: "pending" | "approved" | "rejected";
  requestedBy: string;
  requestedByName?: string;
  decidedBy?: string;
  decidedAt?: unknown;
  createdAt?: unknown;
};

function serialize<T>(snap: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot): T {
  const data = (snap.data() as Record<string, unknown>) ?? {};
  const out: Record<string, unknown> = { id: snap.id };
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
      try {
        out[key] = ((value as { toDate: () => Date }).toDate() as Date).toISOString();
      } catch {
        out[key] = String(value);
      }
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

function cleanValue(value: unknown, depth: number): string | number | boolean | null | unknown[] | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 2000);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value) && depth < 1 && value.length <= 100) {
    const items: unknown[] = [];
    for (const item of value) {
      const cleaned = cleanValue(item, depth + 1);
      if (cleaned === undefined) return undefined;
      items.push(cleaned);
    }
    return items;
  }
  return undefined;
}

function cleanPatch(input: unknown): Record<string, string | number | boolean | null | unknown[]> {
  const patch: Record<string, string | number | boolean | null | unknown[]> = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return patch;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key)) continue;
    const cleaned = cleanValue(value, 0);
    if (cleaned === undefined) continue;
    patch[key] = cleaned as string | number | boolean | null | unknown[];
  }
  return patch;
}

export async function createChangeRequest(input: {
  entity: string;
  entityId: string;
  action: ChangeAction;
  patch?: unknown;
  note?: string;
  requestedBy: string;
  requestedByName?: string;
}): Promise<string> {
  const collection = APPLY_TARGETS[input.entity];
  if (!collection) throw new Error("This item cannot go through approval.");
  if (input.action !== "edit" && input.action !== "delete") throw new Error("Action must be edit or delete.");
  if (!input.entityId || typeof input.entityId !== "string") throw new Error("Item id is required.");
  const patch = input.action === "edit" ? cleanPatch(input.patch) : {};
  if (input.action === "edit" && Object.keys(patch).length === 0) {
    throw new Error("No valid changes supplied.");
  }
  // The target must exist — never approve against a missing doc.
  const target = await adminDb().collection(collection).doc(input.entityId).get();
  if (!target.exists) throw new Error("Item not found.");

  const now = FieldValue.serverTimestamp();
  const ref = await adminDb().collection(COLLECTION).add({
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    patch,
    note: typeof input.note === "string" ? input.note.slice(0, 2000) : "",
    status: "pending",
    requestedBy: input.requestedBy,
    requestedByName: input.requestedByName ?? "",
    createdAt: now,
    updatedAt: now
  });
  void notifyApprovers(input.entity, input.action, input.requestedByName).catch(() => undefined);
  return ref.id;
}

export async function listChangeRequests(status = "pending", limit = 50): Promise<ChangeRequest[]> {
  const snap = await adminDb()
    .collection(COLLECTION)
    .where("status", "==", status)
    .orderBy("createdAt", "desc")
    .limit(Math.min(Math.max(limit, 1), 100))
    .get();
  return snap.docs.map((d) => serialize<ChangeRequest>(d));
}

export async function decideChangeRequest(
  id: string,
  decision: "approved" | "rejected",
  deciderUid: string
): Promise<ChangeRequest> {
  const ref = adminDb().collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Request not found.");
  const request = serialize<ChangeRequest>(snap);
  if (request.status !== "pending") throw new Error("Request already decided.");

  if (decision === "approved") {
    const collection = APPLY_TARGETS[request.entity];
    if (!collection) throw new Error("This item cannot be applied.");
    const target = adminDb().collection(collection).doc(request.entityId);
    if (!(await target.get()).exists) throw new Error("Item no longer exists.");
    if (request.action === "delete") {
      await target.delete();
      if (request.entity === "exam") {
        await deleteExamMarks(request.entityId);
      }
    } else {
      const patch = { ...request.patch } as Record<string, unknown>;
      if (request.entity === "fee_structure" && Array.isArray(patch.heads)) {
        const total = (patch.heads as { amount?: unknown }[]).reduce(
          (sum, h) => sum + (typeof h?.amount === "number" && Number.isFinite(h.amount) ? h.amount : 0),
          0
        );
        patch.total = total;
      }
      await target.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
      if (request.entity === "student") {
        try {
          await markSummaryDirty("student:update");
          await recalculateStudentFeeSummary(request.entityId, String(patch.academicYearId ?? ""));
        } catch (applyError) {
          console.error("[Approvals] student summary recalc failed:", applyError);
        }
      }
    }
  }

  const decided = {
    status: decision,
    decidedBy: deciderUid,
    decidedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  await ref.update(decided);
  try {
    await writeAuditLog({
      action: `approval.${decision}`,
      entityType: "approval",
      entityId: id,
      actorId: deciderUid,
      actorRole: "approver",
      oldValues: { entity: request.entity, entityId: request.entityId, action: request.action }
    });
  } catch (auditError) {
    console.error("[Approvals] audit log write failed:", auditError);
  }
  const fresh = await ref.get();
  return serialize<ChangeRequest>(fresh);
}

/** Exam deletes cascade to marks (mirrors the exams DELETE route). */
async function deleteExamMarks(examId: string): Promise<void> {
  const db = adminDb();
  for (;;) {
    const marks = await db.collection("exam_marks").where("examId", "==", examId).limit(500).get();
    if (marks.empty) break;
    const batch = db.batch();
    marks.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    if (marks.size < 500) break;
  }
}

/**
 * Enforcement gate for edit routes. Approvers and holders of the approve
 * permission apply directly; editors without it get a pending request
 * instead (the route must return early with pending:true).
 */
export async function gateEdit(input: {
  role: Role | undefined;
  approvePermission: Permission;
  entity: string;
  entityId: string;
  action: ChangeAction;
  patch?: unknown;
  note?: string;
  requestedBy: string;
  requestedByName?: string;
}): Promise<{ proceed: true } | { proceed: false; approvalId: string }> {
  if (isApproverRole(input.role)) return { proceed: true };
  if (input.role && (await roleHasPermission(input.role, input.approvePermission))) {
    return { proceed: true };
  }
  const approvalId = await createChangeRequest({
    entity: input.entity,
    entityId: input.entityId,
    action: input.action,
    patch: input.patch,
    note: input.note,
    requestedBy: input.requestedBy,
    requestedByName: input.requestedByName
  });
  return { proceed: false, approvalId };
}

type Approver = { uid: string; role: string };

async function getApprovers(): Promise<Approver[]> {
  const snap = await adminDb()
    .collection("users")
    .where("role", "in", [...APPROVER_ROLES])
    .limit(100)
    .get();
  return snap.docs
    .map((d) => ({ uid: d.id, role: String((d.data() as Record<string, unknown>).role ?? "") }))
    .filter((a) => a.uid);
}

async function notifyApprovers(entity: string, action: ChangeAction, requestedByName?: string): Promise<void> {
  const approvers = await getApprovers();
  if (approvers.length === 0) return;
  const what = `${action === "edit" ? "Edit" : "Delete"} request: ${entity}${requestedByName ? ` by ${requestedByName}` : ""}`;
  const staff = approvers.filter((a) => a.role !== "principal").map((a) => a.uid);
  const principals = approvers.filter((a) => a.role === "principal").map((a) => a.uid);
  await Promise.all([
    staff.length > 0
      ? sendPushToUsers(staff, {
          category: "approval",
          title: "Approval needed",
          body: what,
          route: "/admin/approvals"
        })
      : Promise.resolve(),
    principals.length > 0
      ? sendPushToUsers(principals, {
          category: "approval",
          title: "Approval needed",
          body: what,
          route: "/principal/approvals"
        })
      : Promise.resolve()
  ]);
}
