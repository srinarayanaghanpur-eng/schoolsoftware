import { FieldValue } from "firebase-admin/firestore";
import { toDateKey, transportTripCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requireDriver, serializeDoc } from "@/lib/apiUtils";
import { DriverAssignmentError, resolveDriverAssignment } from "@/lib/driverAdmin";

const COLLECTION = "transport_trips";

function startedAtValue(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime() || 0;
  if (typeof value === "object" && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

export async function GET(req: Request) {
  const token = await requireDriver(req);
  if (!token) return json({ ok: false, error: "Driver access required" }, { status: 403 });

  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  let query = adminDb()
    .collection(COLLECTION)
    .where("driverUid", "==", token.uid);
  if (activeOnly) {
    query = query.where("status", "==", "active");
  }
  const snap = await query.limit(activeOnly ? 10 : 50).get();
  const trips = snap.docs
    .map((doc) => serializeDoc(doc))
    .sort((a, b) => startedAtValue(b.startedAt) - startedAtValue(a.startedAt));

  return json({ ok: true, trips });
}

export async function POST(req: Request) {
  const token = await requireDriver(req);
  if (!token) return json({ ok: false, error: "Driver access required" }, { status: 403 });

  try {
    const parsed = transportTripCreateSchema.parse(await req.json());
    const { driver, vehicle, route, mode } = await resolveDriverAssignment(token.uid);

    const active = await adminDb()
      .collection(COLLECTION)
      .where("driverUid", "==", token.uid)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (!active.empty) {
      return json(
        { ok: false, error: "An active trip already exists. End it before starting another." },
        { status: 409 }
      );
    }

    const date = parsed.date?.trim() || toDateKey(new Date());
    const ref = await adminDb().collection(COLLECTION).add({
      driverId: driver.id,
      driverUid: token.uid,
      vehicleId: vehicle.id,
      routeId: route.id,
      date,
      direction: parsed.direction,
      mode,
      status: "active",
      startedAt: FieldValue.serverTimestamp(),
      totalBoarded: 0,
      totalAlighted: 0
    });

    return json({ ok: true, id: ref.id, date });
  } catch (error) {
    if (error instanceof DriverAssignmentError) {
      return json({ ok: false, error: error.message }, { status: error.status });
    }
    return json({ ok: false, error: errorMessage(error, "Unable to start trip") }, { status: 400 });
  }
}
