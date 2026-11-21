import { FieldValue } from "firebase-admin/firestore";
import { parentUpdateSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { invalidateRoleCache, requirePermission, json } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

export async function PATCH(req: Request, { params }: { params: { parentId: string } }) {
  try {
    const decodedToken = await requirePermission(req, "parents.edit");
    if (!decodedToken) {
      return json({ ok: false, error: "Missing or insufficient permissions." }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentUpdateSchema.parse(body);

    const db = adminDb();
    const userRef = db.collection("users").doc(params.parentId);
    const snapshot = await userRef.get();
    if (!snapshot.exists) {
      return json({ ok: false, error: "Parent not found" }, { status: 404 });
    }

    const existing = snapshot.data() ?? {};
    if (existing.role !== "parent") {
      return json({ ok: false, error: "User is not a parent" }, { status: 400 });
    }

    const timestamp = FieldValue.serverTimestamp();
    const updatedData: Record<string, unknown> = { updatedAt: timestamp };
    if (parsed.fullName) updatedData.displayName = parsed.fullName;
    if (parsed.phone) updatedData.phone = parsed.phone;
    if (parsed.email !== undefined) updatedData.email = parsed.email;
    // Activation control: active | inactive. Missing status counts as active
    // everywhere (login gate, lists), so setting inactive truly deactivates.
    const nextStatus = (body as Record<string, unknown>)?.status;
    if (nextStatus === "active" || nextStatus === "inactive") {
      updatedData.status = nextStatus;
    }

    await userRef.set(updatedData, { merge: true });
    if (updatedData.status) invalidateRoleCache(params.parentId);

    const authUpdate: { displayName?: string; disabled?: boolean } = {};
    if (parsed.fullName) authUpdate.displayName = parsed.fullName;
    if (updatedData.status === "active") authUpdate.disabled = false;
    if (updatedData.status === "inactive") authUpdate.disabled = true;

    if (Object.keys(authUpdate).length > 0) {
      try {
        await adminAuth().updateUser(params.parentId, authUpdate);
        // Refresh tokens fail immediately for deactivated accounts; existing
        // ID tokens still expire normally, while API status checks block them.
        if (authUpdate.disabled === true) await adminAuth().revokeRefreshTokens(params.parentId);
      } catch (authError) {
        const code = (authError as { code?: string })?.code;
        if (code !== "auth/user-not-found") throw authError;
        console.warn(`[ParentsAPI] parent ${params.parentId} has no Firebase Auth user to update`);
      }
    }

    await writeAuditLog({
      action: "parent.updated",
      entityType: "user",
      entityId: params.parentId,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      oldValues: { displayName: existing.displayName, phone: existing.phone, status: existing.status },
      newValues: updatedData as Record<string, unknown>
    });

    return json({ ok: true, message: "Parent updated successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update parent";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

