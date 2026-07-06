import { NextResponse } from "next/server";
import { getDebitVoucher } from "@/lib/debitVoucherService";
import { requirePermission } from "@/lib/apiUtils";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const voucher = await getDebitVoucher(params.id);
  if (!voucher) return NextResponse.json({ ok: false, error: "Debit voucher not found" }, { status: 404 });
  return NextResponse.json({ ok: true, voucher });
}
