import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requireDriver, serializeDoc } from "@/lib/apiUtils";

type TripRecord = {
  id: string;
  driverUid?: string;
  status?: string;
};

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const token = await requireDriver(req);
  if (!token) return json({ ok: false, error: "Driver access required" }, { status: 403 });

  try {
    const { tripId } = await params;
    const tripSnap = await adminDb().collection("transport_trips").doc(tripId).get();
    if (!tripSnap.exists) return json({ ok: false, error: "Trip not found" }, { status: 404 });
    const trip = serializeDoc(tripSnap) as TripRecord;
    if (trip.driverUid !== token.uid) {
      return json({ ok: false, error: "Trip not found" }, { status: 404 });
    }
    if (trip.status !== "active") {
      return json({ ok: false, error: "Trip is not active" }, { status: 409 });
    }

    // End every active trip for this driver. Older builds allowed one active
    // pickup and one active drop at the same time; ending duty clears both.
    const activeTrips = await adminDb()
      .collection("transport_trips")
      .where("driverUid", "==", token.uid)
      .where("status", "==", "active")
      .get();
    const batch = adminDb().batch();
    if (activeTrips.empty) {
      batch.update(adminDb().collection("transport_trips").doc(tripId), {
        status: "completed",
        completedAt: FieldValue.serverTimestamp()
      });
    } else {
      for (const doc of activeTrips.docs) {
        batch.update(doc.ref, {
          status: "completed",
          completedAt: FieldValue.serverTimestamp()
        });
      }
    }
    await batch.commit();

    return json({ ok: true, id: tripId, status: "completed" });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to complete trip") }, { status: 400 });
  }
}
