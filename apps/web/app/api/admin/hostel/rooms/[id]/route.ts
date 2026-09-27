import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

// DELETE /api/admin/hostel/rooms/[id] — blocked while active allotments exist.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(_req, "hostel.delete");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const db = adminDb();
    const ref = db.collection("hostel_rooms").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Room not found" }, { status: 404 });
    const active = await db
      .collection("hostel_allotments")
      .where("roomId", "==", params.id)
      .where("status", "==", "active")
      .limit(1)
      .get()
      .catch(() => null);
    if (active && !active.empty) {
      return json({ ok: false, error: "Cannot delete: room has active allotments" }, { status: 409 });
    }
    await ref.delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 500 });
  }
}
