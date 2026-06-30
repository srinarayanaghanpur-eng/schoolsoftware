import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { BUS_FINANCE_COLLECTION, BUS_EMI_PAYMENTS_COLLECTION, recalcFinanceSummary } from "@/lib/busFinanceService";

/**
 * GET /api/admin/bus-finance/[id]
 * Fetch a single bus finance record (without the schedule).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(BUS_FINANCE_COLLECTION).doc(params.id).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });
    return NextResponse.json({ ok: true, record: { id: snap.id, ...snap.data() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load record";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Fields a client is allowed to update. Numbers are coerced to numbers.
const NUMERIC_FIELDS = new Set(["totalLoanAmount", "downPayment", "emiAmount", "emiDueDay", "totalEmis", "interestRate"]);
const EDITABLE = [
  "vehicleName",
  "vehicleNumber",
  "financeCompany",
  "loanAccountNumber",
  "loanStartDate",
  "loanEndDate",
  "totalLoanAmount",
  "downPayment",
  "emiAmount",
  "emiDueDay",
  "totalEmis",
  "interestRate",
  "status",
  "notes",
];

/**
 * PATCH /api/admin/bus-finance/[id]
 * Update a bus finance record. Also supports closing/cancelling the loan via `status`.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.edit");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const ref = adminDb().collection(BUS_FINANCE_COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });

    const body = await req.json();
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of EDITABLE) {
      if (body[key] === undefined) continue;
      if (NUMERIC_FIELDS.has(key)) {
        update[key] = body[key] === "" || body[key] === null ? null : Number(body[key]);
      } else {
        update[key] = body[key];
      }
    }
    if (update.emiDueDay !== undefined && update.emiDueDay !== null) {
      update.emiDueDay = Math.min(31, Math.max(1, Math.floor(Number(update.emiDueDay) || 1)));
    }

    await ref.update(update);
    // Keep paid/pending/status consistent if status or amounts changed.
    await recalcFinanceSummary(params.id);

    const fresh = await ref.get();
    return NextResponse.json({ ok: true, record: { id: fresh.id, ...fresh.data() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update record";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

/**
 * DELETE /api/admin/bus-finance/[id]
 * Delete a finance record and all its EMI payment rows. Admin-only
 * (bus_finance.delete is granted to admin/super_admin only).
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.delete");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const db = adminDb();
    const ref = db.collection(BUS_FINANCE_COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Record not found" }, { status: 404 });

    // Remove child EMI rows first (batched), then the parent.
    const children = await db.collection(BUS_EMI_PAYMENTS_COLLECTION).where("busFinanceId", "==", params.id).get();
    let batch = db.batch();
    let inBatch = 0;
    for (const child of children.docs) {
      batch.delete(child.ref);
      if (++inBatch >= 450) {
        await batch.commit();
        batch = db.batch();
        inBatch = 0;
      }
    }
    if (inBatch > 0) await batch.commit();

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete record";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
