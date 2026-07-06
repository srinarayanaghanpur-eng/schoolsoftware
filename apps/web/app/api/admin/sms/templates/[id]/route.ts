import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

const COLLECTION = "sms_templates";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "sms.templates");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.body !== undefined) update.body = String(body.body).trim();
    if (body.category !== undefined) update.category = String(body.category).trim();

    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) {
      return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
    }

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update template";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "sms.templates");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const ref = adminDb().collection(COLLECTION).doc(params.id);
  if (!(await ref.get()).exists) {
    return NextResponse.json({ ok: false, error: "Template not found" }, { status: 404 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
