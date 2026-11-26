import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requireDriver } from "@/lib/apiUtils";
import { loadDriverByUid } from "@/lib/driverAdmin";

/**
 * Latest known position for a driver's bus.
 *
 * One document per driver, keyed by the driver record id, so every ping
 * overwrites the previous fix instead of growing a trail. The admin live map
 * (`/api/admin/transport/live-locations`) reads this collection.
 *
 * The mobile driver app posts here only while a trip is active.
 */
const COLLECTION = "driver_locations";

function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  const token = await requireDriver(req);
  if (!token) return json({ ok: false, error: "Driver access required" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return json({ ok: false, error: "Invalid request body" }, { status: 400 });

    const latitude = toFiniteNumber(body.latitude);
    const longitude = toFiniteNumber(body.longitude);
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return json({ ok: false, error: "Valid latitude and longitude are required" }, { status: 400 });
    }

    const driver = await loadDriverByUid(token.uid);
    if (!driver) return json({ ok: false, error: "Driver profile not found" }, { status: 404 });
    if ((driver.status ?? "active") !== "active") {
      return json({ ok: false, error: "Driver account is inactive" }, { status: 403 });
    }

    const ref = adminDb().collection(COLLECTION).doc(driver.id);
    const existing = await ref.get();
    const updatedAtMs = Date.now();

    await ref.set(
      {
        driverId: driver.id,
        driverUid: token.uid,
        driverName: driver.name ?? "",
        vehicleId: driver.vehicleId ?? "",
        routeId: driver.routeId ?? "",
        tripId: typeof body.tripId === "string" && body.tripId ? body.tripId : null,
        latitude,
        longitude,
        accuracy: toFiniteNumber(body.accuracy),
        speed: toFiniteNumber(body.speed),
        heading: toFiniteNumber(body.heading),
        source: typeof body.source === "string" ? body.source.slice(0, 20) : "gps",
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs,
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() })
      },
      { merge: true }
    );

    return json({ ok: true, updatedAtMs });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to save location") }, { status: 400 });
  }
}
