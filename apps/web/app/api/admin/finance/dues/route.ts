import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

// GET /api/admin/finance/dues — outstanding fees grouped by class.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection("students").get();
  const byClass = new Map<string, { className: string; studentCount: number; totalDue: number; students: { id: string; name: string; due: number }[] }>();
  let grandTotalDue = 0;

  snap.docs.forEach((d) => {
    const s = d.data();
    const due = Math.max(0, (Number(s.totalFeesDue) || 0) - (Number(s.totalFeesPaid) || 0));
    if (due <= 0) return;
    grandTotalDue += due;
    const cls = String(s.class || "—");
    const entry = byClass.get(cls) ?? { className: cls, studentCount: 0, totalDue: 0, students: [] };
    entry.studentCount += 1;
    entry.totalDue += due;
    entry.students.push({ id: d.id, name: String(s.studentName || ""), due });
    byClass.set(cls, entry);
  });

  const classes = Array.from(byClass.values()).sort((a, b) => a.className.localeCompare(b.className));
  return NextResponse.json({ ok: true, classes, grandTotalDue, studentsWithDues: classes.reduce((n, c) => n + c.studentCount, 0) });
}
