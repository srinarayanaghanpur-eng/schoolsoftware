import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { ROLE_LABELS } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "@/lib/firebaseAdmin";
import { serializeDoc } from "@/lib/apiUtils";
import {
  PAYROLL_ACCESS_REQUEST_COLLECTION,
  buildPayrollAccessContext,
  canOpenPayrollDirectly,
  expireStalePayrollAccessRequests,
  getPayrollRole,
  isApprovedPayrollRequest,
  logPayrollAccessAudit,
  payrollAccessRequestId,
  readPayrollAccessRequest,
  type PayrollAccessContext,
  type PayrollAccessRequest
} from "@/lib/payrollAccess";

function userLabel(token: Awaited<ReturnType<typeof verifyBearerToken>>) {
  if (!token) return "";
  const name = typeof token.name === "string" ? token.name : "";
  const email = typeof token.email === "string" ? token.email : "";
  return name || email || token.uid;
}

function contextFields(context: PayrollAccessContext) {
  return {
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
    date: context.dateKey
  };
}

export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  const role = getPayrollRole(token);
  if (!token || !role) {
    return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const scope = new URL(req.url).searchParams.get("scope");
  if (scope === "requests") {
    if (role !== "super_admin") {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    // Auto-delete requests from previous days: approvals are per-session,
    // per-day, so yesterday's entries can never be valid and only clutter
    // this list.
    await expireStalePayrollAccessRequests();

    const snapshot = await adminDb()
      .collection(PAYROLL_ACCESS_REQUEST_COLLECTION)
      .orderBy("requestedAt", "desc")
      .limit(50)
      .get();
    return NextResponse.json({
      ok: true,
      requests: snapshot.docs.map((doc) => serializeDoc<PayrollAccessRequest>(doc))
    });
  }

  if (await canOpenPayrollDirectly(role)) {
    return NextResponse.json({ ok: true, access: "direct", role, roleLabel: ROLE_LABELS[role] });
  }

  if (role !== "accountant") {
    return NextResponse.json({ ok: false, error: "Payroll access denied" }, { status: 403 });
  }

  const context = await buildPayrollAccessContext(req, token);
  if (!context) {
    return NextResponse.json({ ok: true, access: "locked", status: "missing_session" });
  }

  const request = await readPayrollAccessRequest(context);
  return NextResponse.json({
    ok: true,
    access: isApprovedPayrollRequest(context, request) ? "approved" : "locked",
    status: request?.status ?? "none",
    request,
    context
  });
}

export async function POST(req: Request) {
  const token = await verifyBearerToken(req);
  const role = getPayrollRole(token);
  if (!token || role !== "accountant") {
    return NextResponse.json({ ok: false, error: "Only accountants can request payroll approval" }, { status: 403 });
  }

  const context = await buildPayrollAccessContext(req, token);
  if (!context) {
    return NextResponse.json({ ok: false, error: "Payroll approval session is required" }, { status: 400 });
  }

  // New request from a fresh login: remove this accountant's requests from
  // older sessions (and any previous-day leftovers) so only the current
  // session's request appears in the admin approvals list.
  await expireStalePayrollAccessRequests({
    accountant: { userId: context.accountantUserId, currentSessionId: context.sessionId }
  });

  const existing = await readPayrollAccessRequest(context);
  const now = new Date().toISOString();
  const id = payrollAccessRequestId(context);
  const body = await req.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  await adminDb()
    .collection(PAYROLL_ACCESS_REQUEST_COLLECTION)
    .doc(id)
    .set(
      {
        ...contextFields(context),
        status: "pending",
        accountantName: userLabel(token),
        accountantEmail: typeof token.email === "string" ? token.email : "",
        requestedAt: now,
        requestedBy: token.uid,
        reason,
        previousStatus: existing?.status ?? "",
        adminNote: "",
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  await logPayrollAccessAudit({
    action: "accountant_requested_access",
    actor: token,
    actorRole: role,
    context,
    requestId: id,
    metadata: { reason, previousStatus: existing?.status ?? "" }
  });

  const request = await readPayrollAccessRequest(context);
  return NextResponse.json({ ok: true, access: "locked", status: "pending", request });
}
