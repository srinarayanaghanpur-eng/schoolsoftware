import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { driverCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "drivers";

export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection(COLLECTION).orderBy("name", "asc").limit(500).get();
  const drivers = snap.docs.map((d) => serializeDoc(d));
  const vehicleIds = [...new Set(drivers.map((f: any) => f.vehicleId).filter(Boolean))];
  let vehicles: Record<string, string> = {};
  if (vehicleIds.length > 0) {
    const vSnap = await adminDb().collection("vehicles").where("__name__", "in", vehicleIds.slice(0, 30)).get();
    vSnap.docs.forEach((d) => { const data = d.data(); vehicles[d.id] = data.regNo || ""; });
  }
  return NextResponse.json({ ok: true, drivers, vehicles });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "transport.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = driverCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, salary: parsed.salary || null, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
