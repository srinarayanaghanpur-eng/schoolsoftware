import type {
  Driver,
  TransportBaseline,
  TransportRoute,
  TransportTripMode,
  Vehicle
} from "@sri-narayana/shared";
import { adminDb } from "./firebaseAdmin";

export type DriverRecord = Driver & { id: string; employeeId?: string };
export type VehicleRecord = Vehicle & { id: string };
export type RouteRecord = TransportRoute & { id: string; code?: string; km?: number; totalKm?: number };
export type BaselineRecord = TransportBaseline & { id: string };

export type DriverAssignmentContext = {
  driver: DriverRecord;
  vehicle: VehicleRecord;
  route: RouteRecord;
  mode: TransportTripMode;
};

export type AssignmentStop = { index: number; name: string };

export class DriverAssignmentError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "DriverAssignmentError";
    this.status = status;
  }
}

function withId<T extends { id?: string }>(id: string, data: T): T & { id: string } {
  return { ...(data as T), id };
}

export async function loadDriverByUid(uid: string): Promise<DriverRecord | null> {
  if (!uid) return null;
  const snap = await adminDb().collection("drivers").where("uid", "==", uid).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return withId(doc.id, doc.data() as Driver);
}

export async function loadDriverById(id: string): Promise<DriverRecord | null> {
  if (!id) return null;
  const snap = await adminDb().collection("drivers").doc(id).get();
  if (!snap.exists) return null;
  return withId(snap.id, snap.data() as Driver);
}

export async function loadBaseline(routeId: string): Promise<BaselineRecord | null> {
  if (!routeId) return null;
  const snap = await adminDb().collection("transport_baselines").doc(routeId).get();
  if (!snap.exists) return null;
  return withId(snap.id, snap.data() as TransportBaseline);
}

export function routeStops(route: RouteRecord): AssignmentStop[] {
  const stops = Array.isArray(route.stops) ? route.stops : [];
  return stops.map((stop, index) => ({ index, name: stop.name }));
}

export async function resolveDriverAssignment(uid: string): Promise<DriverAssignmentContext> {
  const driver = await loadDriverByUid(uid);
  if (!driver) throw new DriverAssignmentError("Driver profile not found", 404);
  if ((driver.status ?? "active") !== "active") {
    throw new DriverAssignmentError("Driver account is inactive", 403);
  }
  if (!driver.vehicleId) {
    throw new DriverAssignmentError("Driver is not linked to a vehicle", 403);
  }

  const vehicleSnap = await adminDb().collection("vehicles").doc(driver.vehicleId).get();
  if (!vehicleSnap.exists) {
    throw new DriverAssignmentError("Assigned vehicle not found", 404);
  }
  const vehicle = withId(vehicleSnap.id, vehicleSnap.data() as Vehicle);

  const routeSnap = await adminDb()
    .collection("transport_routes")
    .where("vehicleId", "==", driver.vehicleId)
    .limit(1)
    .get();
  if (routeSnap.empty) {
    throw new DriverAssignmentError("No route assigned to this vehicle", 404);
  }
  const routeDoc = routeSnap.docs[0];
  const route = withId(routeDoc.id, routeDoc.data() as TransportRoute);

  return {
    driver,
    vehicle,
    route,
    mode: driver.mode ?? "daily"
  };
}
