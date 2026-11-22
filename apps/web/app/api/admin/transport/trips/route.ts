import { adminDb } from "@/lib/firebaseAdmin";
import { json, requirePermission, serializeDoc } from "@/lib/apiUtils";

function startedAtValue(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const search = new URL(req.url).searchParams;
  const date = search.get("date")?.trim();
  const routeId = search.get("routeId")?.trim();
  const driverId = search.get("driverId")?.trim();

  let query: FirebaseFirestore.Query = adminDb().collection("transport_trips");
  if (date) query = query.where("date", "==", date);
  if (routeId) query = query.where("routeId", "==", routeId);
  if (driverId) query = query.where("driverId", "==", driverId);

  const snap = await query.limit(200).get();
  const trips = snap.docs
    .map((doc) => serializeDoc(doc))
    .sort((a, b) => startedAtValue(b.startedAt) - startedAtValue(a.startedAt));

  const tripIds = [...new Set(trips.map((trip) => trip.id))];
  const stopsByTrip = new Map<string, Array<Record<string, unknown> & { id: string }>>();
  for (let i = 0; i < tripIds.length; i += 30) {
    const chunk = tripIds.slice(i, i + 30);
    if (chunk.length === 0) continue;
    const stopsSnap = await adminDb()
      .collection("transport_trip_stops")
      .where("tripId", "in", chunk)
      .limit(1000)
      .get();
    for (const doc of stopsSnap.docs) {
      const stop = serializeDoc(doc);
      const key = String(stop.tripId);
      const list = stopsByTrip.get(key) ?? [];
      list.push(stop);
      stopsByTrip.set(key, list);
    }
  }
  for (const list of stopsByTrip.values()) {
    list.sort((a, b) => Number(a.stopIndex) - Number(b.stopIndex));
  }

  const routeIds = [...new Set(trips.map((trip) => String(trip.routeId ?? "")).filter(Boolean))];
  const baselines: Record<string, Record<string, unknown> & { id: string } | null> = {};
  await Promise.all(
    routeIds.map(async (id) => {
      const baselineSnap = await adminDb().collection("transport_baselines").doc(id).get();
      baselines[id] = baselineSnap.exists ? serializeDoc(baselineSnap) : null;
    })
  );

  const allStops = [...stopsByTrip.values()].flat();
  const tripsWithStops = trips.map((trip) => ({ ...trip, stops: stopsByTrip.get(trip.id) ?? [] }));

  return json({
    ok: true,
    trips: tripsWithStops,
    stops: allStops,
    baseline: routeId ? baselines[routeId] ?? null : null,
    baselines
  });
}
