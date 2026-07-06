import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "sms_templates";

export async function GET(req: Request) {
  const token = await requirePermission(req, "sms.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const snapshot = await adminDb().collection(COLLECTION).orderBy("updatedAt", "desc").limit(200).get();
  const templates = snapshot.docs.map((doc) => serializeDoc<{
    id: string; name: string; body: string; category: string;
    createdAt: string; updatedAt: string;
  }>(doc));
  return NextResponse.json({ ok: true, templates });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "sms.templates");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const templateBody = String(body?.body ?? "").trim();
    const category = String(body?.category ?? "General").trim();

    if (!name || !templateBody) {
      return NextResponse.json({ ok: false, error: "Name and body are required" }, { status: 400 });
    }

    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      name,
      body: templateBody,
      category,
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create template";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
