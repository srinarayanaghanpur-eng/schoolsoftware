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
const NAME_CACHE_TTL_MS = 60 * 60 * 1000;
const nameCache = new Map<string, { value: string; expiresAt: number }>();

async function loadNames(
  collection: string,
  ids: string[],
  field: string
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const names: Record<string, string> = {};
  const missing: string[] = [];
  const now = Date.now();

  for (const id of unique) {
    const cached = nameCache.get(`${collection}:${field}:${id}`);
    if (cached && cached.expiresAt > now) {
      names[id] = cached.value;
    } else {
      missing.push(id);
    }
  }

  for (let i = 0; i < missing.length; i += IN_CHUNK) {
    const chunk = missing.slice(i, i + IN_CHUNK);
    const snap = await adminDb().collection(collection).where("__name__", "in", chunk).get();
    const found = new Set<string>();
    snap.docs.forEach((doc) => {
      const value = (doc.data() as Record<string, unknown>)[field];
      const name = typeof value === "string" ? value : "";
      names[doc.id] = name;
      found.add(doc.id);
      nameCache.set(`${collection}:${field}:${doc.id}`, {
        value: name,
        expiresAt: now + NAME_CACHE_TTL_MS
      });
    });
    for (const id of chunk) {
      if (!found.has(id)) {
        nameCache.set(`${collection}:${field}:${id}`, {
          value: "",
          expiresAt: now + NAME_CACHE_TTL_MS
        });
      }
    }
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
