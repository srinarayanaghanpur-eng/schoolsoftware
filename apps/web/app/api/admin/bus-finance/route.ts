import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { BUS_FINANCE_COLLECTION, generateEmiSchedule } from "@/lib/busFinanceService";

/**
 * GET /api/admin/bus-finance
 * List all bus/vehicle finance (loan) records.
 */
export async function GET(req: NextRequest) {
  const token = await requirePermission(req, "bus_finance.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    let query: FirebaseFirestore.Query = adminDb().collection(BUS_FINANCE_COLLECTION);
    const status = searchParams.get("status");
    if (status) query = query.where("status", "==", status);

    const snap = await query.get();
    const records = snap.docs
      .map((d) => serializeDoc(d) as Record<string, unknown> & { id: string })
      .sort((a, b) => String(a.vehicleNumber ?? "").localeCompare(String(b.vehicleNumber ?? "")));

    return NextResponse.json({ ok: true, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load bus finance records";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

const REQUIRED = [
  "vehicleName",
  "vehicleNumber",
  "financeCompany",
  "loanAccountNumber",
  "loanStartDate",
  "loanEndDate",
] as const;

/**
 * POST /api/admin/bus-finance
 * Create a new bus finance record and auto-generate its EMI schedule.
 */
export async function POST(req: NextRequest) {
  const token = await requirePermission(req, "bus_finance.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();

    for (const field of REQUIRED) {
      if (!body[field] || String(body[field]).trim() === "") {
        return NextResponse.json({ ok: false, error: `Missing required field: ${field}` }, { status: 400 });
      }
    }

    const totalEmis = Math.floor(Number(body.totalEmis) || 0);
    const emiAmount = Number(body.emiAmount) || 0;
    const emiDueDay = Math.min(31, Math.max(1, Math.floor(Number(body.emiDueDay) || 1)));
    if (totalEmis <= 0) return NextResponse.json({ ok: false, error: "totalEmis must be greater than 0" }, { status: 400 });
    if (emiAmount <= 0) return NextResponse.json({ ok: false, error: "emiAmount must be greater than 0" }, { status: 400 });

    const now = FieldValue.serverTimestamp();
    const vehicleNumber = String(body.vehicleNumber).trim();

    const record: Record<string, unknown> = {
      vehicleName: String(body.vehicleName).trim(),
      vehicleNumber,
      financeCompany: String(body.financeCompany).trim(),
      loanAccountNumber: String(body.loanAccountNumber).trim(),
      loanStartDate: String(body.loanStartDate),
      loanEndDate: String(body.loanEndDate),
      totalLoanAmount: Number(body.totalLoanAmount) || 0,
      downPayment: Number(body.downPayment) || 0,
      emiAmount,
      emiDueDay,
      totalEmis,
      paidEmis: 0,
      pendingEmis: totalEmis,
      interestRate: body.interestRate !== undefined && body.interestRate !== "" ? Number(body.interestRate) : null,
      status: "active",
      notes: body.notes ? String(body.notes) : "",
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await adminDb().collection(BUS_FINANCE_COLLECTION).add(record);

    // Auto-generate the monthly EMI schedule (idempotent).
    const generated = await generateEmiSchedule(ref.id, {
      vehicleNumber,
      emiAmount,
      totalEmis,
      emiDueDay,
      loanStartDate: String(body.loanStartDate),
    });

    return NextResponse.json({ ok: true, id: ref.id, emisGenerated: generated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create bus finance record";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
