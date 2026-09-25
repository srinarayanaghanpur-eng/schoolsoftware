import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requireAdmin, json } from "@/lib/apiUtils";
import { generateResetLinkForUid, resolveResetTarget } from "@/lib/passwordResetLink";

type RouteContext = { params: { requestId: string } };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * POST /api/admin/password-reset-requests/[requestId]/reset-link
 * Issues a ONE-TIME Firebase password-reset link for an open request.
 * The admin copies the link and shares it with the staff member directly
 * (in person / WhatsApp). No password is created, stored, or emailed by us.
 * Replaces the old manual reset-password endpoint.
 */
export async function POST(req: Request, { params }: RouteContext) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const requestId = params.requestId.trim();
    if (!requestId) {
      return json({ ok: false, error: "Request ID is required" }, { status: 400 });
    }

    const db = adminDb();
    const requestRef = db.collection("password_reset_requests").doc(requestId);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists) {
      return json({ ok: false, error: "Password request not found" }, { status: 404 });
    }

    const requestData = requestSnapshot.data() as Record<string, unknown>;
    if (text(requestData.status).toLowerCase() !== "open") {
      return json({ ok: false, error: "This password request is already resolved." }, { status: 409 });
    }

    const target = await resolveResetTarget(requestData);
    if (target.role === "super_admin" && decodedToken.role !== "super_admin") {
      return json({ ok: false, error: "Only a super admin can reset a super admin password." }, { status: 403 });
    }

    const resetLink = await generateResetLinkForUid(target.uid);
    const issuedAt = new Date().toISOString();

    await requestRef.set(
      {
        status: "link_issued",
        linkIssuedAt: issuedAt,
        linkIssuedBy: decodedToken.uid,
        targetUid: target.uid,
        targetType: target.type,
        updatedAt: issuedAt,
        updatedBy: decodedToken.uid
      },
      { merge: true }
    );

    await db.collection("password_reset_history").add({
      action: "reset_link_issued",
      targetType: target.type,
      targetUid: target.uid,
      teacherId: target.type === "teacher" ? target.teacherId : "",
      teacherName: target.type === "teacher" ? target.name : "",
      userId: target.type === "user" ? target.uid : "",
      userName: target.type === "user" ? target.name : "",
      userRole: target.role ?? "",
      employeeId: target.employeeId,
      issuedBy: decodedToken.uid,
      issuedAt,
      requestId
    });

    await db.collection("admin_audit_logs").add({
      action: "password_reset_link_issued",
      targetType: target.type,
      targetUid: target.uid,
      requestId,
      createdAt: issuedAt,
      createdBy: decodedToken.uid
    });

    // NOTE: the link itself is returned once and never persisted — it is a
    // bearer token equivalent to account access until used/expired.
    return json({
      ok: true,
      resetLink,
      employeeId: target.employeeId,
      name: target.name,
      message: "One-time reset link issued. Share it directly with the staff member; it expires after use."
    });
  } catch (error) {
    // Never leak Admin SDK internals; surface safe message. A missing auth
    // user or unconfigured action URL lands here as 400.
    return json({ ok: false, error: errorMessage(error, "Unable to issue reset link") }, { status: 400 });
  }
}
