import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

// GET /api/admin/finance/dues — outstanding fees grouped by class.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  const pageSize = readLimit(searchParams.get("limit") ?? searchParams.get("pageSize"), 500, 1000);

  let query: FirebaseFirestore.Query = adminDb().collection("studentFeeSummaries").where("dueAmount", ">", 0);
  if (branchId) query = query.where("branchId", "==", branchId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (classFilter) query = query.where("classId", "==", classFilter);
  if (sectionFilter) query = query.where("sectionId", "==", sectionFilter);
  query = query.orderBy("dueAmount", "desc").limit(pageSize);

  const snap = await query.get();
  logFirestoreRead("FinanceDuesAPI", "studentFeeSummaries", snap, { branchId, academicYearId, classFilter, sectionFilter, pageSize });

  const byClass = new Map<string, { className: string; studentCount: number; totalDue: number; students: { id: string; name: string; due: number }[] }>();
  let grandTotalDue = 0;

  snap.docs.forEach((d) => {
    const s = d.data();
    const due = Math.max(0, Number(s.dueAmount) || 0);
    if (due <= 0) return;
    grandTotalDue += due;
    const cls = String(s.className || s.classId || "—");
    const entry = byClass.get(cls) ?? { className: cls, studentCount: 0, totalDue: 0, students: [] };
    entry.studentCount += 1;
    entry.totalDue += due;
    entry.students.push({ id: String(s.studentId || d.id), name: String(s.studentName || ""), due });
    byClass.set(cls, entry);
  });

  const classes = Array.from(byClass.values()).sort((a, b) => a.className.localeCompare(b.className));
  return NextResponse.json({ ok: true, classes, grandTotalDue, studentsWithDues: classes.reduce((n, c) => n + c.studentCount, 0), pageSize, truncated: snap.size === pageSize });
}
