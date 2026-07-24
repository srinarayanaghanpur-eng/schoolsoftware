import { FieldValue } from "firebase-admin/firestore";
import { expenseCreateSchema, expenseStatusUpdateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

const COLLECTION = "expenses";

// PATCH /api/admin/finance/expenses/[id]
//  - { status: "approved"|"rejected" }  → approval (needs fees.approve)
//  - otherwise partial edit (needs fees.edit)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const isApproval = body && typeof body.status === "string";
  const token = await requirePermission(req, isApproval ? "fees.approve" : "fees.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const ref = adminDb().collection(COLLECTION).doc(params.id);
  if (!(await ref.get()).exists) return json({ ok: false, error: "Expense not found" }, { status: 404 });

  try {
    if (isApproval) {
      const { status } = expenseStatusUpdateSchema.parse(body);
      await ref.update({ status, approvedBy: token.uid, updatedAt: FieldValue.serverTimestamp() });
    } else {
      const parsed = expenseCreateSchema.partial().parse(body);
      await ref.update({ ...parsed, updatedAt: FieldValue.serverTimestamp() });
    }
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update expense";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

// DELETE /api/admin/finance/expenses/[id]
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  await adminDb().collection(COLLECTION).doc(params.id).delete();
  return json({ ok: true });
}

