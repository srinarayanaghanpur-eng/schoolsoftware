import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

// GET /api/admin/finance/defaulters?class=X – students with outstanding dues.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classFilter = searchParams.get("class");

  let query: any = adminDb().collection("students");
  if (classFilter) query = query.where("class", "==", classFilter);

  const snap = await query.get();
  const today = new Date();
  const defaulterList: {
    id: string;
    studentName: string;
    className: string;
    admissionNumber: string;
    totalDue: number;
    lastPaymentDate: string | null;
    daysOverdue: number;
  }[] = [];

  snap.docs.forEach((d: any) => {
    const s = d.data();
    const totalDue = Math.max(0, (Number(s.totalFeesDue) || 0) - (Number(s.totalFeesPaid) || 0));
    if (totalDue <= 0) return;

    const lastDate = s.lastPaymentDate?.toDate?.().toISOString() || s.lastPaymentDate || null;
    const daysOverdue = lastDate
      ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    defaulterList.push({
      id: d.id,
      studentName: String(s.studentName || ""),
      className: String(s.class || "—"),
      admissionNumber: String(s.admissionNumber || ""),
      totalDue,
      lastPaymentDate: lastDate,
      daysOverdue
    });
  });

  defaulterList.sort((a, b) => b.totalDue - a.totalDue);

  return NextResponse.json({ ok: true, data: defaulterList });
}
