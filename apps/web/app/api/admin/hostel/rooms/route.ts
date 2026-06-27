import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { hostelRoomCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "hostel_rooms";

export async function GET(req: Request) {
  const token = await requirePermission(req, "hostel.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection(COLLECTION).get();
  return NextResponse.json({ ok: true, rooms: snap.docs.map((d) => serializeDoc(d)) });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "hostel.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = hostelRoomCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, occupied: 0, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
