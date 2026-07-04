import { NextResponse } from "next/server";
import { AggregateField } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { logFirestoreAggregateRead, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const { searchParams } = new URL(req.url);
  const pageSize = readLimit(searchParams.get("limit") ?? searchParams.get("pageSize"), 100, 500);

  // Totals come from aggregate queries (1 read each) so they stay correct even
  // though the bill list below is capped.
  const [unpaidAgg, partialAgg, paidAgg, billsSnap] = await Promise.all([
    db.collection("purchases").where("status", "==", "unpaid")
      .aggregate({ amount: AggregateField.sum("amount"), count: AggregateField.count() }).get(),
    db.collection("purchases").where("status", "==", "partial")
      .aggregate({ amount: AggregateField.sum("amount"), amountPaid: AggregateField.sum("amountPaid"), count: AggregateField.count() }).get(),
    db.collection("purchases").where("status", "==", "paid")
      .aggregate({ amount: AggregateField.sum("amount"), count: AggregateField.count() }).get(),
    db.collection("purchases").orderBy("date", "desc").limit(pageSize).get()
  ]);

  logFirestoreAggregateRead("FinancePayablesAPI", "purchases", { operation: "status-sums" });
  logFirestoreRead("FinancePayablesAPI", "purchases", billsSnap, { pageSize });

  const unpaid = unpaidAgg.data();
  const partial = partialAgg.data();
  const paid = paidAgg.data();

  const totalPayable = (Number(unpaid.amount) || 0) + ((Number(partial.amount) || 0) - (Number(partial.amountPaid) || 0));
  const totalPaid = (Number(paid.amount) || 0) + (Number(partial.amountPaid) || 0);

  const purchases = billsSnap.docs.map((d) => serializeDoc(d));

  // Group by vendor (based on the latest `pageSize` bills).
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
      billCount: (Number(unpaid.count) || 0) + (Number(partial.count) || 0) + (Number(paid.count) || 0),
      unpaidCount: Number(unpaid.count) || 0,
      partialCount: Number(partial.count) || 0,
      paidCount: Number(paid.count) || 0
    },
    byVendor: Object.values(byVendor).sort((a, b) => b.due - a.due),
    bills: purchases,
    truncated: billsSnap.size === pageSize
  });
}
