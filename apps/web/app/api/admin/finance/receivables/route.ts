import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classFilter = searchParams.get("class");
  const db = adminDb();

  let query: FirebaseFirestore.Query = db.collection("students");
  if (classFilter) query = query.where("className", "==", classFilter);

  const studentSnap = await query.get();
  const students = studentSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const receivables = students
    .map((s: Record<string, unknown>) => {
      const due = Math.max(0, (Number(s.totalFeesDue) || 0) - (Number(s.totalFeesPaid) || 0));
      return {
        id: s.id,
        studentName: String(s.studentName || s.name || ""),
        className: String(s.className || s.class || ""),
        admissionNumber: String(s.admissionNumber || ""),
        totalFees: Number(s.totalFeeAmount || s.totalFeesDue || 0),
        paid: Number(s.totalFeesPaid || 0),
        due,
        lastPaymentDate: s.lastPaymentDate ? String(s.lastPaymentDate) : null,
        feeStatus: String(s.feeStatus || s.status || "")
      };
    })
    .filter((r) => r.due > 0)
    .sort((a, b) => b.due - a.due);

  const totalReceivable = receivables.reduce((s, r) => s + r.due, 0);
  const totalFees = receivables.reduce((s, r) => s + r.totalFees, 0);
  const totalPaid = receivables.reduce((s, r) => s + r.paid, 0);

  // Group by class
  const byClass: Record<string, { className: string; count: number; totalFees: number; paid: number; due: number }> = {};
  receivables.forEach((r) => {
    if (!byClass[r.className]) byClass[r.className] = { className: r.className, count: 0, totalFees: 0, paid: 0, due: 0 };
    byClass[r.className].count += 1;
    byClass[r.className].totalFees += r.totalFees;
    byClass[r.className].paid += r.paid;
    byClass[r.className].due += r.due;
  });

  return NextResponse.json({
    ok: true,
    summary: { totalReceivable, totalFees, totalPaid, studentCount: receivables.length },
    byClass: Object.values(byClass).sort((a, b) => a.className.localeCompare(b.className)),
    students: receivables
  });
}
