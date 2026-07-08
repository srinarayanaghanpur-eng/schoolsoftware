import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import {
  BUS_FINANCE_COLLECTION,
  BUS_EMI_PAYMENTS_COLLECTION,
  generateEmiSchedule,
  recalcFinanceSummary,
} from "@/lib/busFinanceService";

/**
 * GET /api/admin/bus-finance/[id]/emi-schedule
 * Return the full EMI schedule (payment rows) for one bus finance record,
 * ordered by EMI number.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb()
      .collection(BUS_EMI_PAYMENTS_COLLECTION)
      .where("busFinanceId", "==", params.id)
      .get();
    const schedule = snap.docs
      .map((d) => serializeDoc(d) as Record<string, unknown> & { id: string; emiNumber: number })
      .sort((a, b) => Number(a.emiNumber) - Number(b.emiNumber));
    return json({ ok: true, schedule });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load EMI schedule";
    return json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/bus-finance/[id]/emi-schedule
 * Regenerate only the MISSING EMI rows for a finance record (idempotent — never
 * duplicates existing rows). Useful if a schedule was partially created.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "bus_finance.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const ref = adminDb().collection(BUS_FINANCE_COLLECTION).doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: "Record not found" }, { status: 404 });

    const f = snap.data() as Record<string, unknown>;
    const created = await generateEmiSchedule(params.id, {
      vehicleNumber: String(f.vehicleNumber ?? ""),
      emiAmount: Number(f.emiAmount) || 0,
      totalEmis: Math.floor(Number(f.totalEmis) || 0),
      emiDueDay: Math.min(31, Math.max(1, Math.floor(Number(f.emiDueDay) || 1))),
      loanStartDate: String(f.loanStartDate ?? ""),
    });
    await recalcFinanceSummary(params.id);

    return json({ ok: true, emisGenerated: created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to regenerate EMI schedule";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
