import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import {
  PAYROLL_ACCESS_REQUEST_COLLECTION,
  getPayrollRole,
  logPayrollAccessAudit,
  type PayrollAccessContext,
  type PayrollApprovalStatus
} from "@/lib/payrollAccess";

function contextFromRequest(data: Record<string, unknown>): PayrollAccessContext {
  return {
    accountantUserId: String(data.accountantUserId ?? ""),
    sessionId: String(data.sessionId ?? ""),
    sessionAuthTime: Number(data.sessionAuthTime ?? 0),
    schoolId: String(data.schoolId ?? data.school_id ?? "default-school"),
    branchId: String(data.branchId ?? data.branch_id ?? "default-branch"),
    academicYearId: String(data.academicYearId ?? data.academic_year_id ?? "none"),
    dateKey: String(data.dateKey ?? data.date ?? "")
  };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await verifyBearerToken(req);
  const role = getPayrollRole(token);
  if (!token || (role !== "super_admin" && role !== "admin")) {
    return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action === "approve" ? "approve" : body?.action === "reject" ? "reject" : "";
  if (!action) {
    return NextResponse.json({ ok: false, error: "Action must be approve or reject" }, { status: 400 });
  }

  const docRef = adminDb().collection(PAYROLL_ACCESS_REQUEST_COLLECTION).doc(params.id);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    return NextResponse.json({ ok: false, error: "Payroll approval request not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const data = snapshot.data() ?? {};
  const nextStatus: PayrollApprovalStatus = action === "approve" ? "approved" : "rejected";
  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
  const context = contextFromRequest(data);

  await docRef.set(
    {
      status: nextStatus,
      adminNote,
      reviewedAt: now,
      reviewedBy: token.uid,
      ...(action === "approve" ? { approvedAt: now, approvedBy: token.uid } : { rejectedAt: now, rejectedBy: token.uid }),
      updatedAt: now,
      updatedAtServer: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await logPayrollAccessAudit({
    action: action === "approve" ? "admin_approved" : "admin_rejected",
    actor: token,
    actorRole: role,
    context,
    requestId: params.id,
    metadata: { adminNote }
  });

  return NextResponse.json({ ok: true, id: params.id, status: nextStatus });
}
