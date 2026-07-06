import { NextResponse } from "next/server";
import { errorMessage, requirePermission } from "@/lib/apiUtils";
import {
  createDebitVoucherFromExpense,
  listDebitVouchers
} from "@/lib/debitVoucherService";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const ids = searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean);
  const result = await listDebitVouchers({
    ids,
    voucherNo: searchParams.get("voucherNo"),
    date: searchParams.get("date"),
    paidTo: searchParams.get("paidTo"),
    category: searchParams.get("category"),
    amount: searchParams.get("amount"),
    academicYear: searchParams.get("academicYear"),
    limit: searchParams.get("limit"),
    cursor: searchParams.get("cursor")
  });

  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const result = await createDebitVoucherFromExpense(await req.json(), token, { expenseStatus: "approved" });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error, "Unable to create debit voucher") }, { status: 400 });
  }
}
