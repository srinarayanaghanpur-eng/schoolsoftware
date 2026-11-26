import { FieldValue } from "firebase-admin/firestore";
import { transportRouteCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission, resolveRole } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

const COLLECTION = "transport_routes";
const routeUpdateSchema = transportRouteCreateSchema.partial();

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { id } = await params;
    const parsed = routeUpdateSchema.parse(await req.json());
    const ref = adminDb().collection(COLLECTION).doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) return json({ ok: false, error: "Route not found" }, { status: 404 });
    const before = snapshot.data() ?? {};

    if (parsed.vehicleId) {
      const vehicle = await adminDb().collection("vehicles").doc(parsed.vehicleId).get();
      if (!vehicle.exists) return json({ ok: false, error: "Assigned vehicle not found" }, { status: 404 });
    }

    await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });

    await writeAuditLog({
      action: "transport_route.updated",
      entityType: "transport_route",
      entityId: id,
      actorId: token.uid,
      actorRole: (await resolveRole(token)) ?? "unknown",
      oldValues: {
        name: before.name ?? "",
        vehicleId: before.vehicleId ?? "",
        stops: Array.isArray(before.stops) ? before.stops.length : 0
      },
      newValues: {
        name: parsed.name ?? before.name ?? "",
        vehicleId: parsed.vehicleId ?? before.vehicleId ?? "",
        stops: parsed.stops ? parsed.stops.length : Array.isArray(before.stops) ? before.stops.length : 0
      }
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
    if (!snapshot.exists) return json({ ok: false, error: "Route not found" }, { status: 404 });

    const [drivers, assignments] = await Promise.all([
      adminDb().collection("drivers").where("routeId", "==", id).limit(1).get(),
      adminDb().collection("transport_assignments").where("routeId", "==", id).limit(1).get()
    ]);
    if (!drivers.empty || !assignments.empty) {
      return json(
        { ok: false, error: "This route is linked to a driver or students. Unlink it first." },
        { status: 409 }
      );
    }

    const before = snapshot.data() ?? {};
    await ref.delete();

    await writeAuditLog({
      action: "transport_route.deleted",
      entityType: "transport_route",
      entityId: id,
      actorId: token.uid,
      actorRole: (await resolveRole(token)) ?? "unknown",
      oldValues: {
        name: before.name ?? "",
        vehicleId: before.vehicleId ?? "",
        stops: Array.isArray(before.stops) ? before.stops.length : 0
      }
    });

    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed") }, { status: 400 });
  }
}
