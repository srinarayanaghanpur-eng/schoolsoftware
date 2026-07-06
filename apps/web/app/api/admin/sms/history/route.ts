import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "sms_history";

export async function GET(req: Request) {
  const token = await requirePermission(req, "sms.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

  const snapshot = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(limit).get();
  const entries = snapshot.docs.map((doc) => serializeDoc(doc));
  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "sms.mark_sent");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const recipientCount = Number(body?.recipientCount) || 0;
    const templateUsed = String(body?.templateUsed ?? "").trim();
    const messagePreview = String(body?.messagePreview ?? "").slice(0, 500);

    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      sentBy: token.uid,
      sentByName: String(body?.sentByName ?? "Unknown"),
      recipientCount,
      templateUsed,
      messagePreview,
      status: "marked_sent",
      createdAt: now
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to log SMS";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
