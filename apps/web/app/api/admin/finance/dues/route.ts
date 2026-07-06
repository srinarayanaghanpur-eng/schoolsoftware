import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
// GET /api/admin/finance/dues — outstanding fees grouped by class.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get("branchId") || "";
  const schoolId = searchParams.get("schoolId") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  // Default 25 for list views; exports/reports may request more explicitly (up to 1000).
  const pageSize = readLimit(searchParams.get("limit") ?? searchParams.get("pageSize"), 25, 1000);
  const cursor = docCursor(searchParams.get("cursor"));

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries").where("dueAmount", ">", 0);
  if (schoolId) query = query.where("schoolId", "==", schoolId);
  if (branchId) query = query.where("branchId", "==", branchId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (classFilter) query = query.where("classId", "==", classFilter);
  if (sectionFilter) query = query.where("sectionId", "==", sectionFilter);
  query = query.orderBy("dueAmount", "desc");

  if (cursor) {
    const cursorDoc = await db.collection("studentFeeSummaries").doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  query = query.limit(pageSize + 1);

  const snap = await query.get();
  logFirestoreRead("FinanceDuesAPI", "studentFeeSummaries", snap, { schoolId, branchId, academicYearId, classFilter, sectionFilter, pageSize });
  const pageDocs = snap.docs.slice(0, pageSize);
  const nextCursor = snap.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

  const byClass = new Map<string, { className: string; studentCount: number; totalDue: number; students: { id: string; name: string; due: number }[] }>();
  let grandTotalDue = 0;

  pageDocs.forEach((d) => {
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
  return NextResponse.json({ ok: true, classes, grandTotalDue, studentsWithDues: classes.reduce((n, c) => n + c.studentCount, 0), pageSize, nextCursor, hasMore: Boolean(nextCursor), truncated: Boolean(nextCursor) });
}
