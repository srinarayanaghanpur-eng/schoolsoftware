import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docDateKey } from "@/lib/financeUtils";

// GET /api/admin/finance/receipt/[paymentId] — structured data for a printable receipt/invoice.
export async function GET(req: Request, { params }: { params: { paymentId: string } }) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const db = adminDb();
  const paySnap = await db.collection("payments").doc(params.paymentId).get();
  if (!paySnap.exists) return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
  const p = paySnap.data() as Record<string, unknown>;

  const studentSnap = p.studentId ? await db.collection("students").doc(String(p.studentId)).get() : null;
  const s = studentSnap?.data() as Record<string, unknown> | undefined;
  const settingsSnap = await db.collection("settings").doc("school").get();
  const schoolName = (settingsSnap.data()?.schoolName as string) || DEFAULT_SETTINGS.schoolName;

  return NextResponse.json({
    ok: true,
    receipt: {
      receiptNo: params.paymentId,
      schoolName,
      date: docDateKey(p),
      student: s ? { id: p.studentId, name: s.studentName || "", admissionNo: s.admissionNumber || "", className: s.class || "", section: s.section || "" } : null,
      amount: Number(p.amountPaid) || 0,
      paymentType: p.paymentType || "",
      paymentMethod: p.paymentMethod || "",
      transactionId: p.transactionId || "",
      status: p.status || "completed"
    }
  });
}
