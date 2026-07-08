import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const token = await requirePermission(req, "fees.edit");
    if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

    const body = await req.json();

    const ref = adminDb().collection("fee_reminders").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return json({ ok: false, error: "Reminder not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (typeof body.sent === "boolean") updateData.sent = body.sent;
    if (body.sentAt) updateData.sentAt = body.sentAt;

    await ref.update(updateData);
    return json({ ok: true, message: "Reminder updated." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update reminder";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

