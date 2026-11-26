import { adminDb } from "@/lib/firebaseAdmin";
import { json, requirePermission, serializeDoc } from "@/lib/apiUtils";

/**
 * Latest bus positions for the admin live map.
 *
 * Reads the single-document-per-driver `driver_locations` collection written
 * by `/api/driver/location`, then joins the vehicle registration and route
 * name so the map can label each marker without extra client calls.
 */
const COLLECTION = "driver_locations";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const MAX_DOCS = 100;
const IN_CHUNK = 30;

async function loadNames(
  collection: string,
  ids: string[],
  field: string
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names: Record<string, string> = {};
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    const chunk = unique.slice(i, i + IN_CHUNK);
    const snap = await adminDb().collection(collection).where("__name__", "in", chunk).get();
    snap.docs.forEach((doc) => {
      const value = (doc.data() as Record<string, unknown>)[field];
      names[doc.id] = typeof value === "string" ? value : "";
    });
  }
  return names;
}

function timestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "toDate" in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === "function") return fn.call(value).getTime();
  }
  return null;
}

export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb()
    .collection(COLLECTION)
    .orderBy("updatedAtMs", "desc")
    .limit(MAX_DOCS)
    .get();

  const locations = snap.docs.map((doc) => serializeDoc<Record<string, unknown>>(doc));
  const vehicleNames = await loadNames(
    "vehicles",
    locations.map((l) => String(l.vehicleId ?? "")),
    "regNo"
  );
  const routeNames = await loadNames(
    "transport_routes",
    locations.map((l) => String(l.routeId ?? "")),
    "name"
  );

  const now = Date.now();
  const result = locations.map((location) => {
    const lastSeenMs = timestampMs(location.updatedAtMs) ?? timestampMs(location.updatedAt);
    return {
      ...location,
      vehicleRegNo: vehicleNames[String(location.vehicleId ?? "")] ?? "",
      routeName: routeNames[String(location.routeId ?? "")] ?? "",
      lastSeenMs,
      online: lastSeenMs !== null && now - lastSeenMs <= ONLINE_WINDOW_MS
    };
  });

  return json({
    ok: true,
    serverTime: now,
    onlineWindowMs: ONLINE_WINDOW_MS,
    locations: result
  });
}
