import { FieldValue } from "firebase-admin/firestore";
import { isValidRole } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, resolveRole, invalidateRoleCache, json } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

// PATCH /api/admin/users/[uid]/role — assign a role (requires users.edit).
// Sets the Firebase custom claim AND the users/{uid} doc so login resolves it.
//
// SECURITY (privilege-escalation guard): only a super_admin may grant the
// super_admin or settings_manager roles. Without this check any account with
// users.edit could promote itself (or a sock-puppet account) to super_admin.
// Every actual role change is written to the audit log.
const PRIVILEGED_ROLES = new Set(["super_admin", "settings_manager"]);

export async function PATCH(req: Request, { params }: { params: { uid: string } }) {
  const token = await requirePermission(req, "users.edit");
  if (!token) return json({ ok: false, error: "Admin access required" }, { status: 403 });

  try {
    const body = await req.json();
    const role = body?.role;
    if (!isValidRole(role)) {
      return json({ ok: false, error: "Invalid role" }, { status: 400 });
    }

    const actorRole = await resolveRole(token);
    if (PRIVILEGED_ROLES.has(role) && actorRole !== "super_admin") {
      return json(
        { ok: false, error: "Only a super admin can grant this role" },
        { status: 403 }
      );
    }

    const auth = adminAuth();
    const user = await auth.getUser(params.uid); // 404s if the uid doesn't exist
    const existingClaims = user.customClaims ?? {};
    const previousRole = typeof existingClaims.role === "string" ? existingClaims.role : "";

    await auth.setCustomUserClaims(params.uid, { ...existingClaims, role });

    await adminDb()
      .collection("users")
      .doc(params.uid)
      .set({ uid: params.uid, role, status: "active", updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    invalidateRoleCache(params.uid);

    if (previousRole !== role) {
      await writeAuditLog({
        action: "user.role_changed",
        entityType: "user",
        entityId: params.uid,
        actorId: token.uid,
        actorRole: actorRole ?? "unknown",
        oldValues: previousRole ? { role: previousRole } : undefined,
        newValues: { role }
      });
    }

    return json({ ok: true, uid: params.uid, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign role";
    const status = message.includes("no user record") ? 404 : 400;
    return json({ ok: false, error: message }, { status });
  }
}
