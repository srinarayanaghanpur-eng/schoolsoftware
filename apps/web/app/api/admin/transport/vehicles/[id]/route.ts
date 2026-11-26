import { FieldValue } from "firebase-admin/firestore";
import { vehicleCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission, resolveRole } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

const COLLECTION = "vehicles";
const vehicleUpdateSchema = vehicleCreateSchema.partial();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { id } = await params;
    const parsed = vehicleUpdateSchema.parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return json({ ok: false, error: "Vehicle not found" }, { status: 404 });
    const before = snapshot.data() ?? {};

    if (parsed.regNo) {
      const duplicate = await adminDb()
        .collection(COLLECTION)
        .where("regNo", "==", parsed.regNo)
        .limit(2)
        .get();
      if (duplicate.docs.some((doc) => doc.id !== id)) {
        return json({ ok: false, error: "Another vehicle already uses this registration number" }, { status: 409 });
      }
    }

    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });

    await writeAuditLog({
      action: "vehicle.updated",
      entityType: "vehicle",
      entityId: id,
      actorId: token.uid,
      actorRole: (await resolveRole(token)) ?? "unknown",
      oldValues: {
        regNo: before.regNo ?? "",
        capacity: before.capacity ?? 0,
        driverName: before.driverName ?? "",
        driverPhone: before.driverPhone ?? ""
      },
      newValues: parsed
    });

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed") }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { id } = await params;
    const ref = adminDb().collection(COLLECTION).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return json({ ok: false, error: "Vehicle not found" }, { status: 404 });

    const [drivers, routes] = await Promise.all([
      adminDb().collection("drivers").where("vehicleId", "==", id).limit(1).get(),
      adminDb().collection("transport_routes").where("vehicleId", "==", id).limit(1).get()
    ]);
    if (!drivers.empty || !routes.empty) {
      return json(
        { ok: false, error: "This vehicle is linked to a driver or route. Unlink it first." },
        { status: 409 }
      );
    }

    const before = snapshot.data() ?? {};
    await ref.delete();

    await writeAuditLog({
      action: "vehicle.deleted",
      entityType: "vehicle",
      entityId: id,
      actorId: token.uid,
      actorRole: (await resolveRole(token)) ?? "unknown",
      oldValues: {
        regNo: before.regNo ?? "",
        capacity: before.capacity ?? 0,
        driverName: before.driverName ?? ""
      }
    });

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed") }, { status: 400 });
  }
}
