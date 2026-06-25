import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { feeStructureCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

const COLLECTION = "fee_structures";

// PATCH /api/admin/fee-structures/[id] — edit (recomputes total if heads change).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = feeStructureCreateSchema.partial().parse(await req.json());
    const update: Record<string, unknown> = { ...parsed, updatedAt: FieldValue.serverTimestamp() };
    if (parsed.heads) update.total = parsed.heads.reduce((sum, h) => sum + h.amount, 0);
    const ref = adminDb().collection(COLLECTION).doc(params.id);
    if (!(await ref.get()).exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update fee structure";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

// DELETE /api/admin/fee-structures/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  await adminDb().collection(COLLECTION).doc(params.id).delete();
  return NextResponse.json({ ok: true });
}
