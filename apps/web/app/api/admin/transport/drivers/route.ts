import { FieldValue } from "firebase-admin/firestore";
import { driverCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "drivers";

export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection(COLLECTION).orderBy("name", "asc").limit(500).get();
  const drivers = snap.docs.map((d) => serializeDoc(d));
  const vehicleIds = [...new Set(drivers.map((f: any) => f.vehicleId).filter(Boolean))];
  const uids = [...new Set(drivers.map((f: any) => f.uid).filter(Boolean))];

  const vehicles: Record<string, string> = {};
  const vehicleDocs: Record<string, Record<string, unknown>> = {};
  if (vehicleIds.length > 0) {
    const vSnap = await adminDb().collection("vehicles").where("__name__", "in", vehicleIds.slice(0, 30)).get();
    vSnap.docs.forEach((d) => {
      const data = d.data();
      vehicles[d.id] = data.regNo || "";
      vehicleDocs[d.id] = data;
    });
  }

  const userDocs: Record<string, Record<string, unknown>> = {};
  if (uids.length > 0) {
    const uSnap = await adminDb().collection("users").where("__name__", "in", uids.slice(0, 30)).get();
    uSnap.docs.forEach((d) => { userDocs[d.id] = d.data(); });
  }

  const routeSnap = await adminDb().collection("transport_routes").limit(500).get();
  const routeById: Record<string, { id: string; name: string }> = {};
  const routeByVehicle: Record<string, { id: string; name: string }> = {};
  routeSnap.docs.forEach((d) => {
    const data = d.data();
    const entry = { id: d.id, name: typeof data.name === "string" ? data.name : "" };
    routeById[d.id] = entry;
    if (typeof data.vehicleId === "string" && data.vehicleId && !routeByVehicle[data.vehicleId]) {
      routeByVehicle[data.vehicleId] = entry;
    }
  });

  // Drivers store their own route when one is set, but routes are also linked
  // by vehicle. Resolve both so the driver list matches the assignment API.
  const enriched = drivers.map((driver: any) => {
    const user = userDocs[driver.uid] ?? {};
    const vehicle = vehicleDocs[driver.vehicleId] ?? {};
    const route = routeById[driver.routeId] ?? routeByVehicle[driver.vehicleId];
    return {
      ...driver,
      employeeId: driver.employeeId || user.employeeId || "",
      phone:
        driver.phone ||
        user.phone ||
        user.mobile ||
        vehicle.driverPhone ||
        "",
      routeId: driver.routeId || route?.id || "",
      routeName: route?.name || "",
      vehicleRegNo: vehicle.regNo || ""
    };
  });

  return json({ ok: true, drivers: enriched, vehicles });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "transport.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = driverCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, salary: parsed.salary || null, createdAt: now, updatedAt: now });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

