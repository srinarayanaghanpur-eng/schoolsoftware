import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { parentMessageReplySchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

const COLLECTION = "parent_messages";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = parentMessageReplySchema.parse(body);

    const ref = adminDb().collection(COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 });
    }

    await ref.update({
      status: parsed.status,
      reply: parsed.reply,
      repliedBy: decodedToken.uid,
      repliedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });

    await writeAuditLog({
      action: "parent_message_replied",
      entityType: "parent_message",
      entityId: params.id,
      actorId: decodedToken.uid,
      actorRole: decodedToken.role as string,
      newValues: { status: parsed.status, reply: parsed.reply }
    });

    return NextResponse.json({ ok: true, message: "Reply sent." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reply";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
