import { FieldValue } from "firebase-admin/firestore";
import { hostelAllotmentTransferSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// POST /api/admin/hostel/allotments/[id]/transfer — move an active allotment to another room.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "hostel.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = hostelAllotmentTransferSchema.parse(await req.json());
    const db = adminDb();
    const ref = db.collection("hostel_allotments").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Allotment not found" }, { status: 404 });
    const allotment = snap.data() as { roomId?: string; status?: string };
    if (allotment.status !== "active") return json({ ok: false, error: "Allotment is not active" }, { status: 400 });
    if (allotment.roomId === parsed.roomId) return json({ ok: false, error: "Student is already in this room" }, { status: 400 });

    const oldRef = allotment.roomId ? db.collection("hostel_rooms").doc(allotment.roomId) : null;
    const newRef = db.collection("hostel_rooms").doc(parsed.roomId);
    const [oldRoom, newRoom] = await Promise.all([oldRef ? oldRef.get() : null, newRef.get()]);
    if (!newRoom.exists) return json({ ok: false, error: "Target room not found" }, { status: 404 });
    const target = newRoom.data() as { number: string; capacity: number; occupied?: number };
    if ((target.occupied || 0) >= target.capacity) return json({ ok: false, error: "Target room is full" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    if (oldRef && oldRoom?.exists) {
      batch.update(oldRef, { occupied: Math.max(0, ((oldRoom.data()?.occupied as number) || 0) - 1), updatedAt: now });
    }
    batch.update(newRef, { occupied: (target.occupied || 0) + 1, updatedAt: now });
    batch.update(ref, {
      roomId: parsed.roomId,
      roomNumber: target.number,
      fromDate: parsed.fromDate || new Date().toISOString().slice(0, 10),
      transferredAt: now,
      updatedAt: now
    });
    await batch.commit();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
