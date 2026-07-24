import { adminDb } from "@/lib/firebaseAdmin";
import { removeUndefinedFields } from "@/lib/firestoreSanitize";
import type { AuditAction, AuditLogEntry } from "@sri-narayana/shared";

type WriteAuditParams = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  reason?: string;
  branch?: string;
  deviceInfo?: string;
  ipAddress?: string;
  approvalId?: string;
  academicYearId?: string;
};

export async function writeAuditLog(params: WriteAuditParams): Promise<string> {
  const docRef = adminDb().collection("audit_logs").doc();
  const entry = removeUndefinedFields({
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    actorId: params.actorId,
    actorRole: params.actorRole,
    oldValues: params.oldValues,
    newValues: params.newValues,
    reason: params.reason,
    branch: params.branch,
    deviceInfo: params.deviceInfo,
    ipAddress: params.ipAddress,
    approvalId: params.approvalId,
    academicYearId: params.academicYearId,
    createdAt: new Date().toISOString()
  } satisfies AuditLogEntry);
  await docRef.set(entry);
  return docRef.id;
}

export async function getAuditLogs(options: {
  entityType?: string;
  entityId?: string;
  actorId?: string;
  action?: string;
  limit?: number;
} = {}): Promise<AuditLogEntry[]> {
  let query: FirebaseFirestore.Query = adminDb().collection("audit_logs");

  if (options.entityType) query = query.where("entityType", "==", options.entityType);
  if (options.entityId) query = query.where("entityId", "==", options.entityId);
  if (options.actorId) query = query.where("actorId", "==", options.actorId);
  if (options.action) query = query.where("action", "==", options.action);

  const snapshot = await query
    .orderBy("createdAt", "desc")
    .limit(options.limit ?? 100)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
}
