import type { DecodedIdToken } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { hasPermission, isValidRole, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";

export type PayrollApprovalStatus = "pending" | "approved" | "rejected";

export type PayrollAccessContext = {
  accountantUserId: string;
  sessionId: string;
  sessionAuthTime: number;
  schoolId: string;
  branchId: string;
  academicYearId: string;
  dateKey: string;
};

export type PayrollAccessRequest = PayrollAccessContext & {
  id: string;
  status: PayrollApprovalStatus;
  accountantName?: string;
  accountantEmail?: string;
  requestedAt?: string;
  requestedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  adminNote?: string;
  updatedAt?: string;
};

export type PayrollAccessResult =
  | { ok: true; token: DecodedIdToken; role: Role; mode: "direct" }
  | { ok: true; token: DecodedIdToken; role: "accountant"; mode: "approved"; context: PayrollAccessContext; request: PayrollAccessRequest }
  | { ok: false; status: number; error: string; token?: DecodedIdToken; role?: Role; context?: PayrollAccessContext; request?: PayrollAccessRequest | null };

const REQUEST_COLLECTION = "payroll_access_requests";
const AUDIT_COLLECTION = "payroll_access_audit_logs";

export function getPayrollRole(token: DecodedIdToken | null): Role | undefined {
  const role = token?.role;
  return isValidRole(role) ? role : undefined;
}

export function canOpenPayrollDirectly(role: Role | undefined) {
  return Boolean(role && (role === "super_admin" || role === "admin" || role === "principal") && hasPermission(role, "payroll.view"));
}

export function istDateKey(date = new Date()) {
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

export function payrollAccessRequestId(context: PayrollAccessContext) {
  return [
    context.schoolId,
    context.branchId,
    context.academicYearId,
    context.dateKey,
    context.accountantUserId,
    context.sessionId
  ]
    .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, "_"))
    .join("__");
}

function stringClaim(token: DecodedIdToken, ...names: string[]) {
  for (const name of names) {
    const value = token[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

async function getActiveAcademicYearId() {
  const snapshot = await adminDb()
    .collection("academic_years")
    .where("isActive", "==", true)
    .limit(1)
    .get()
    .catch(() => null);

  return snapshot?.docs[0]?.id ?? "none";
}

export async function buildPayrollAccessContext(req: Request, token: DecodedIdToken): Promise<PayrollAccessContext | null> {
  const sessionId = req.headers.get("x-payroll-session-id")?.trim();
  if (!sessionId) return null;

  return {
    accountantUserId: token.uid,
    sessionId,
    sessionAuthTime: Number(token.auth_time ?? 0),
    schoolId: stringClaim(token, "school_id", "schoolId") || process.env.SCHOOL_ID || "default-school",
    branchId: stringClaim(token, "branch_id", "branchId") || process.env.BRANCH_ID || "default-branch",
    academicYearId: await getActiveAcademicYearId(),
    dateKey: istDateKey()
  };
}

export async function readPayrollAccessRequest(context: PayrollAccessContext): Promise<PayrollAccessRequest | null> {
  const doc = await adminDb().collection(REQUEST_COLLECTION).doc(payrollAccessRequestId(context)).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<PayrollAccessRequest, "id">) };
}

export function isApprovedPayrollRequest(context: PayrollAccessContext, request: PayrollAccessRequest | null) {
  return Boolean(
    request &&
      request.status === "approved" &&
      request.accountantUserId === context.accountantUserId &&
      request.sessionId === context.sessionId &&
      request.sessionAuthTime === context.sessionAuthTime &&
      request.schoolId === context.schoolId &&
      request.branchId === context.branchId &&
      request.academicYearId === context.academicYearId &&
      request.dateKey === context.dateKey
  );
}

export async function logPayrollAccessAudit({
  action,
  actor,
  actorRole,
  context,
  requestId,
  metadata
}: {
  action: "accountant_requested_access" | "admin_approved" | "admin_rejected" | "accountant_opened_payroll";
  actor: DecodedIdToken;
  actorRole?: Role;
  context: PayrollAccessContext;
  requestId?: string;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  await adminDb().collection(AUDIT_COLLECTION).add({
    action,
    actorUserId: actor.uid,
    actorRole: actorRole ?? getPayrollRole(actor) ?? "",
    requestId: requestId ?? payrollAccessRequestId(context),
    accountantUserId: context.accountantUserId,
    sessionId: context.sessionId,
    sessionAuthTime: context.sessionAuthTime,
    schoolId: context.schoolId,
    school_id: context.schoolId,
    branchId: context.branchId,
    branch_id: context.branchId,
    academicYearId: context.academicYearId,
    academic_year_id: context.academicYearId,
    dateKey: context.dateKey,
    date: context.dateKey,
    metadata: metadata ?? {},
    createdAt: now,
    createdAtServer: FieldValue.serverTimestamp()
  });
}

export async function requirePayrollAccess(req: Request): Promise<PayrollAccessResult> {
  const token = await verifyBearerToken(req);
  const role = getPayrollRole(token);

  if (!token || !role || !hasPermission(role, "payroll.view")) {
    return { ok: false, status: 403, error: "Payroll access denied", token: token ?? undefined, role };
  }

  if (canOpenPayrollDirectly(role)) {
    return { ok: true, token, role, mode: "direct" };
  }

  if (role !== "accountant") {
    return { ok: false, status: 403, error: "Payroll access denied", token, role };
  }

  const context = await buildPayrollAccessContext(req, token);
  if (!context) {
    return { ok: false, status: 403, error: "Payroll approval session is required", token, role };
  }

  const request = await readPayrollAccessRequest(context);
  if (!isApprovedPayrollRequest(context, request) || !request) {
    return { ok: false, status: 403, error: "Admin approval is required for this payroll session", token, role, context, request };
  }

  return { ok: true, token, role, mode: "approved", context, request };
}

export { REQUEST_COLLECTION as PAYROLL_ACCESS_REQUEST_COLLECTION };
