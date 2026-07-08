import { getDebitVoucher } from "@/lib/debitVoucherService";
import { requirePermission, json } from "@/lib/apiUtils";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const voucher = await getDebitVoucher(params.id);
  if (!voucher) return json({ ok: false, error: "Debit voucher not found" }, { status: 404 });
  return json({ ok: true, voucher });
}

