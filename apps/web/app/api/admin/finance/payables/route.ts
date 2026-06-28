import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const purchaseSnap = await db.collection("purchases").get();

  const purchases = purchaseSnap.docs.map((d) => serializeDoc(d));

  const unpaid = purchases.filter((p) => p.status === "unpaid");
  const partial = purchases.filter((p) => p.status === "partial");
  const paid = purchases.filter((p) => p.status === "paid");

  const totalPayable = unpaid.reduce((s, p) => s + (Number(p.amount) || 0), 0) +
    partial.reduce((s, p) => s + ((Number(p.amount) || 0) - (Number(p.amountPaid) || 0)), 0);
  const totalPaid = paid.reduce((s, p) => s + (Number(p.amount) || 0), 0) +
    partial.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0);

  // Group by vendor
  const byVendor: Record<string, { vendorId: string; vendorName: string; total: number; paid: number; due: number; count: number }> = {};
  purchases.forEach((p) => {
    const vid = String(p.vendorId || "unknown");
    if (!byVendor[vid]) byVendor[vid] = { vendorId: vid, vendorName: String(p.vendorName || "Unknown"), total: 0, paid: 0, due: 0, count: 0 };
    byVendor[vid].total += Number(p.amount) || 0;
    byVendor[vid].paid += Number(p.amountPaid) || 0;
    byVendor[vid].due += (Number(p.amount) || 0) - (Number(p.amountPaid) || 0);
    byVendor[vid].count += 1;
  });

  return NextResponse.json({
    ok: true,
    summary: {
      totalPayable,
      totalPaid,
      outstanding: totalPayable,
      billCount: purchases.length,
      unpaidCount: unpaid.length,
      partialCount: partial.length,
      paidCount: paid.length
    },
    byVendor: Object.values(byVendor).sort((a, b) => b.due - a.due),
    bills: purchases.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
  });
}
