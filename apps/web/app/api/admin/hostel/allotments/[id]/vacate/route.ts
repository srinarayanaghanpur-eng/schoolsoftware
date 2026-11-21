import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// POST /api/admin/hostel/allotments/[id]/vacate — free the bed.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "hostel.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const db = adminDb();
    const ref = db.collection("hostel_allotments").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Allotment not found" }, { status: 404 });
    const allotment = snap.data() as { roomId?: string; status?: string };
    if (allotment.status !== "active") return json({ ok: false, error: "Allotment is not active" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const roomRef = allotment.roomId ? db.collection("hostel_rooms").doc(allotment.roomId) : null;
    const room = roomRef ? await roomRef.get() : null;
    const batch = db.batch();
    if (roomRef && room?.exists) {
      batch.update(roomRef, { occupied: Math.max(0, ((room.data()?.occupied as number) || 0) - 1), updatedAt: now });
    }
    batch.update(ref, { status: "vacated", vacatedDate: new Date().toISOString().slice(0, 10), updatedAt: now });
    await batch.commit();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}
