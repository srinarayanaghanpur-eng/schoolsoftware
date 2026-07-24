import { FieldValue } from "firebase-admin/firestore";
import { parentUpdateSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";
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

    await userRef.set(updatedData, { merge: true });

    if (parsed.fullName) {
      await adminAuth().updateUser(params.parentId, { displayName: parsed.fullName });
    }

    await writeAuditLog({
      action: "parent.updated",
      entityType: "user",
      entityId: params.parentId,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      oldValues: { displayName: existing.displayName, phone: existing.phone },
      newValues: updatedData as Record<string, unknown>
    });

    return json({ ok: true, message: "Parent updated successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update parent";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

