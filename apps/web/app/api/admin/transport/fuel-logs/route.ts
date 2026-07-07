import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { fuelLogCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "fuel_logs";

export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const vehicleId = searchParams.get("vehicleId");
  let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION).orderBy("date", "desc").limit(500);
  if (vehicleId) query = query.where("vehicleId", "==", vehicleId);
  const snap = await query.get();
  const fuelLogs = snap.docs.map((d) => serializeDoc(d));
  const vehicleIds = [...new Set(fuelLogs.map((f: any) => f.vehicleId).filter(Boolean))];
  let vehicles: Record<string, string> = {};
  if (vehicleIds.length > 0) {
    const vSnap = await adminDb().collection("vehicles").where("__name__", "in", vehicleIds.slice(0, 30)).get();
    vSnap.docs.forEach((d) => { const data = d.data(); vehicles[d.id] = data.regNo || ""; });
  }
  return NextResponse.json({ ok: true, fuelLogs, vehicles });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "transport.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = fuelLogCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const totalCost = Number((parsed.liters * parsed.costPerLiter).toFixed(2));
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, totalCost, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
