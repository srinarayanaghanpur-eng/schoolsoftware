import { FieldValue } from "firebase-admin/firestore";
import { hostelAllotmentSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";

const COLLECTION = "hostel_allotments";

export async function GET(req: Request) {
  const token = await requirePermission(req, "hostel.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  const snap = await adminDb().collection(COLLECTION).where("status", "==", "active").limit(500).get();
  return json({ ok: true, allotments: snap.docs.map((d) => serializeDoc(d)) });
}

// POST — allot a room to a student (increments occupancy; rejects if full).
export async function POST(req: Request) {
  const token = await requirePermission(req, "hostel.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = hostelAllotmentSchema.parse(await req.json());
    const db = adminDb();
    const roomRef = db.collection("hostel_rooms").doc(parsed.roomId);
    const room = await roomRef.get();
    if (!room.exists) return json({ ok: false, error: "Room not found" }, { status: 404 });
    const r = room.data() as { number: string; capacity: number; occupied: number };
    if ((r.occupied || 0) >= r.capacity) return json({ ok: false, error: "Room is full" }, { status: 400 });

    const student = await db.collection("students").doc(parsed.studentId).get();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    batch.update(roomRef, { occupied: (r.occupied || 0) + 1, updatedAt: now });
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, { ...parsed, studentName: (student.data()?.studentName as string) || "", roomNumber: r.number, status: "active", createdAt: now });
    await batch.commit();
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

