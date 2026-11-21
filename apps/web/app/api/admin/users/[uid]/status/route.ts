import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, invalidateRoleCache, json, requirePermission } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

// PATCH /api/admin/users/[uid]/status — activate or deactivate a login.
// Firestore status is the source of truth; Firebase Auth disabled mirrors it so
// the account cannot obtain a fresh token. Existing ID tokens are additionally
// rejected by the shared API status gate.
export async function PATCH(req: Request, { params }: { params: { uid: string } }) {
  const token = await requirePermission(req, "users.edit");
  if (!token) return json({ ok: false, error: "Admin access required" }, { status: 403 });

  try {
    const body = (await req.json()) as { status?: unknown };
    const status = body?.status;
    if (status !== "active" && status !== "inactive") {
      return json({ ok: false, error: "Status must be active or inactive" }, { status: 400 });
    }
    if (params.uid === token.uid && status === "inactive") {
      return json({ ok: false, error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const userRef = adminDb().collection("users").doc(params.uid);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      return json({ ok: false, error: "User not found" }, { status: 404 });
    }
    const existing = snapshot.data() as Record<string, unknown>;
    const previousStatus = typeof existing.status === "string" ? existing.status : "active";

    await userRef.set(
      { status, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    invalidateRoleCache(params.uid);

    try {
      await adminAuth().updateUser(params.uid, { disabled: status === "inactive" });
      if (status === "inactive") await adminAuth().revokeRefreshTokens(params.uid);
    } catch (authError) {
      const code = (authError as { code?: string })?.code;
      if (code !== "auth/user-not-found") throw authError;
      console.warn(`[UsersAPI] user ${params.uid} has no Firebase Auth record to update`);
    }

    if (previousStatus !== status) {
      await writeAuditLog({
        action: status === "inactive" ? "user.deactivated" : "user.activated",
        entityType: "user",
        entityId: params.uid,
        actorId: token.uid,
        actorRole: (token.role as string) ?? "unknown",
        oldValues: { status: previousStatus },
        newValues: { status }
      });
    }

    return json({ ok: true, uid: params.uid, status });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to update account status") }, { status: 400 });
  }
}
