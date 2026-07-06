import { NextResponse } from "next/server";
import { hasPermission, type Role } from "@sri-narayana/shared";
import { requirePermission } from "@/lib/apiUtils";
import { createReceiptFromPayment, getReceiptById } from "@/lib/receiptService";

// GET /api/admin/finance/receipt/[paymentId] — compatibility endpoint for
// existing payment-history links. It returns the canonical digital receipt and
// creates one for older completed payments that predate the new receipt schema.
export async function GET(req: Request, { params }: { params: { paymentId: string } }) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const canPrint = hasPermission(token.role as Role | undefined, "fees.create");
    const existing = await getReceiptById(params.paymentId);
    const receipt = existing || (canPrint ? await createReceiptFromPayment(params.paymentId, token) : null);
    if (!receipt) return NextResponse.json({ ok: false, error: "Receipt not found" }, { status: 404 });
    return NextResponse.json({ ok: true, receipt, canPrint });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load receipt";
    return NextResponse.json({ ok: false, error: message }, { status: 404 });
  }
}
