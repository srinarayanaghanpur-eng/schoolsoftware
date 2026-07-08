import { FieldValue } from "firebase-admin/firestore";
import { dailyKmLogCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "daily_km_logs";

export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const vehicleId = searchParams.get("vehicleId");
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION).orderBy("date", "desc").limit(500);
  if (vehicleId) query = query.where("vehicleId", "==", vehicleId);
  const snap = await query.get();
  const logs = snap.docs.map((d) => serializeDoc(d));
  const vehicleIds = [...new Set(logs.map((f: any) => f.vehicleId).filter(Boolean))];
  let vehicles: Record<string, string> = {};
  if (vehicleIds.length > 0) {
    const vSnap = await adminDb().collection("vehicles").where("__name__", "in", vehicleIds.slice(0, 30)).get();
    vSnap.docs.forEach((d) => { const data = d.data(); vehicles[d.id] = data.regNo || ""; });
  }
  return json({ ok: true, dailyKmLogs: logs, vehicles });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "transport.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = dailyKmLogCreateSchema.parse(await req.json());
    if (parsed.endOdometer < parsed.startOdometer) {
      return json({ ok: false, error: "End odometer must be >= start odometer" }, { status: 400 });
    }
    const now = FieldValue.serverTimestamp();
    const kmRun = parsed.endOdometer - parsed.startOdometer;
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, kmRun, createdAt: now, updatedAt: now });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

