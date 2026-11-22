import { FieldValue } from "firebase-admin/firestore";
import { driverUpdateSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, invalidateRoleCache, json, requirePermission, resolveRole } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

const COLLECTION = "drivers";

type DriverDoc = {
  uid?: string;
  status?: string;
  mode?: string;
  vehicleId?: string;
  routeId?: string;
};

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const { id } = await params;
    const parsed = driverUpdateSchema.parse(await req.json());

    const driverRef = adminDb().collection(COLLECTION).doc(id);
    const snapshot = await driverRef.get();
    if (!snapshot.exists) return json({ ok: false, error: "Driver not found" }, { status: 404 });
    const existing = (snapshot.data() ?? {}) as DriverDoc;

    const merged: DriverDoc = { ...existing, ...parsed };
    const uid = (merged.uid ?? "").trim();
    const status = merged.status ?? "active";
    const mode = merged.mode ?? "daily";
    const vehicleId = merged.vehicleId ?? "";

    const uidChanged = parsed.uid !== undefined && (parsed.uid ?? "") !== (existing.uid ?? "");
    const statusChanged = parsed.status !== undefined && status !== (existing.status ?? "active");
    const modeChanged = parsed.mode !== undefined && mode !== (existing.mode ?? "daily");
    const vehicleChanged = parsed.vehicleId !== undefined && vehicleId !== (existing.vehicleId ?? "");
    const routeChanged = parsed.routeId !== undefined && (parsed.routeId ?? "") !== (existing.routeId ?? "");
    const shouldSync = Boolean(uid) && (uidChanged || statusChanged || modeChanged || vehicleChanged);

    const update: Record<string, unknown> = { ...parsed, updatedAt: FieldValue.serverTimestamp() };
    if (parsed.salary === undefined) update.salary = null;
    await driverRef.update(update);

    if (shouldSync) {
      const auth = adminAuth();
      try {
        const user = await auth.getUser(uid);
        await auth.setCustomUserClaims(uid, {
          ...(user.customClaims ?? {}),
          role: "driver",
          driverId: id,
          vehicleId,
          status
        });
        await adminDb().collection("users").doc(uid).set(
          { driverId: id, vehicleId, status, updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        await auth.revokeRefreshTokens(uid);
        invalidateRoleCache(uid);
      } catch (authError) {
        const code = (authError as { code?: string })?.code;
        if (code !== "auth/user-not-found") throw authError;
        console.warn(`[TransportDriversAPI] driver ${id} uid ${uid} has no Firebase Auth record`);
      }
    }

    if (uidChanged || statusChanged || modeChanged || vehicleChanged || routeChanged) {
      await writeAuditLog({
        action: "driver.updated",
        entityType: "driver",
        entityId: id,
        actorId: token.uid,
        actorRole: (await resolveRole(token)) ?? "unknown",
        oldValues: {
          uid: existing.uid ?? "",
          status: existing.status ?? "active",
          mode: existing.mode ?? "daily",
          vehicleId: existing.vehicleId ?? "",
          routeId: existing.routeId ?? ""
        },
        newValues: { uid, status, mode, vehicleId, routeId: merged.routeId ?? "" }
      });
    }

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed") }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const { id } = await params;
    await adminDb().collection(COLLECTION).doc(id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
