import { adminDb } from "@/lib/firebaseAdmin";
import { json, requireDriver, serializeDoc } from "@/lib/apiUtils";

export async function GET(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const token = await requireDriver(req);
  if (!token) return json({ ok: false, error: "Driver access required" }, { status: 403 });

  const { tripId } = await params;
  const tripSnap = await adminDb().collection("transport_trips").doc(tripId).get();
  if (!tripSnap.exists) return json({ ok: false, error: "Trip not found" }, { status: 404 });

  const trip = serializeDoc(tripSnap) as Record<string, unknown> & { id: string };
  if (trip.driverUid !== token.uid) {
    return json({ ok: false, error: "Trip not found" }, { status: 404 });
  }

  const stopsSnap = await adminDb()
    .collection("transport_trip_stops")
    .where("tripId", "==", tripId)
    .limit(500)
    .get();
  const stops = stopsSnap.docs
    .map((doc) => serializeDoc(doc))
    .sort((a, b) => Number(a.stopIndex) - Number(b.stopIndex));

  return json({ ok: true, trip, stops });
}
