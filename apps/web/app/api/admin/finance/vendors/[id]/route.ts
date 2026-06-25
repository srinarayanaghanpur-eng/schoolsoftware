import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { vendorCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

const COLLECTION = "vendors";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const parsed = vendorCreateSchema.partial().parse(await req.json());
    await adminDb().collection(COLLECTION).doc(params.id).update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to update vendor" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });
  await adminDb().collection(COLLECTION).doc(params.id).delete();
  return NextResponse.json({ ok: true });
}
