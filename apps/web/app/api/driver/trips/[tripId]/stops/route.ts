import { FieldValue } from "firebase-admin/firestore";
import { transportTripStopSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requireDriver, serializeDoc } from "@/lib/apiUtils";
import {
  DriverAssignmentError,
  resolveDriverAssignment,
  routeStops,
  type RouteRecord
} from "@/lib/driverAdmin";

type TripRecord = {
  id: string;
  driverUid?: string;
  vehicleId?: string;
  routeId?: string;
  status?: string;
};

function findRouteStop(route: RouteRecord, index: number) {
  return routeStops(route).find((stop) => stop.index === index);
}

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const token = await requireDriver(req);
  if (!token) return json({ ok: false, error: "Driver access required" }, { status: 403 });

  try {
    const { tripId } = await params;
    const parsed = transportTripStopSchema.parse(await req.json());

    const tripSnap = await adminDb().collection("transport_trips").doc(tripId).get();
    if (!tripSnap.exists) return json({ ok: false, error: "Trip not found" }, { status: 404 });
    const trip = serializeDoc(tripSnap) as TripRecord;
    if (trip.driverUid !== token.uid) {
      return json({ ok: false, error: "Trip not found" }, { status: 404 });
    }
    if (trip.status !== "active") {
      return json({ ok: false, error: "Trip is not active" }, { status: 409 });
    }

    const { vehicle, route, mode } = await resolveDriverAssignment(token.uid);
    if (trip.routeId !== route.id || trip.vehicleId !== vehicle.id) {
      return json({ ok: false, error: "Trip does not match your current assignment" }, { status: 403 });
    }
    if (mode === "first_day") {
      return json(
        { ok: false, error: "This trip only records the first-day baseline" },
        { status: 403 }
      );
    }

    const routeStop = findRouteStop(route, parsed.stopIndex);
    if (!routeStop) {
      return json({ ok: false, error: "Stop is not part of this route" }, { status: 400 });
    }
    if (routeStop.name.trim() !== parsed.stopName) {
      return json({ ok: false, error: "Stop name does not match the route stop" }, { status: 400 });
    }

    const stopsSnap = await adminDb()
      .collection("transport_trip_stops")
      .where("tripId", "==", tripId)
      .limit(500)
      .get();
    const existing = stopsSnap.docs.map((doc) => ({ doc, data: serializeDoc(doc) }));
    let totalBoarded = 0;
    let totalAlighted = 0;
    for (const item of existing) {
      if (Number(item.data.stopIndex) === parsed.stopIndex) continue;
      totalBoarded += Number(item.data.boarded) || 0;
      totalAlighted += Number(item.data.alighted) || 0;
    }
    totalBoarded += parsed.boarded;
    totalAlighted += parsed.alighted;

    const capacity = Number(vehicle.capacity) || 0;
    if (totalBoarded + totalAlighted > capacity) {
      return json(
        { ok: false, error: `Counts exceed vehicle capacity (${capacity})` },
        { status: 400 }
      );
    }

    const payload = {
      tripId,
      driverUid: token.uid,
      routeId: route.id,
      stopIndex: parsed.stopIndex,
      stopName: routeStop.name,
      boarded: parsed.boarded,
      alighted: parsed.alighted,
      recordedAt: FieldValue.serverTimestamp()
    };

    const existingStop = existing.find((item) => Number(item.data.stopIndex) === parsed.stopIndex);
    let stopId: string;
    if (existingStop) {
      stopId = existingStop.doc.id;
      await existingStop.doc.ref.set(payload, { merge: true });
    } else {
      const ref = await adminDb().collection("transport_trip_stops").add(payload);
      stopId = ref.id;
    }

    await adminDb().collection("transport_trips").doc(tripId).update({
      totalBoarded,
      totalAlighted
    });

    return json({
      ok: true,
      stopId,
      stop: {
        tripId,
        stopIndex: parsed.stopIndex,
        stopName: routeStop.name,
        boarded: parsed.boarded,
        alighted: parsed.alighted
      },
      totals: { totalBoarded, totalAlighted }
    });
  } catch (error) {
    if (error instanceof DriverAssignmentError) {
      return json({ ok: false, error: error.message }, { status: error.status });
    }
    return json({ ok: false, error: errorMessage(error, "Unable to record stop") }, { status: 400 });
  }
}
