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
  const schoolId = searchParams.get("schoolId") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  // Default 25 for list views; exports/reports may request more explicitly (up to 1000).
  const pageSize = readLimit(searchParams.get("limit") ?? searchParams.get("pageSize"), 25, 1000);
  const cursor = searchParams.get("cursor")?.trim() || "";

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries");
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  else if (schoolId) query = query.where("schoolId", "==", schoolId);
  const snap = await query.limit(1000).get();
  logFirestoreRead("FinanceDuesAPI", "studentFeeSummaries", snap, { schoolId, branchId, academicYearId, classFilter, sectionFilter, pageSize });
  const filteredDocs = snap.docs
    .filter((doc) => {
      const data = doc.data();
      const balanceDue = Math.max(0, Number(data.dueAmount) || 0);
      return balanceDue > 0
        && String(data.feeStatus || "") !== "paid"
        && (!schoolId || String(data.schoolId || "") === schoolId)
        && (!branchId || String(data.branchId || "") === branchId)
        && (!academicYearId || String(data.academicYearId || "") === academicYearId)
        && (!classFilter || String(data.classId || data.className || "") === classFilter)
        && (!sectionFilter || String(data.sectionId || data.sectionName || "") === sectionFilter);
    })
    .sort((left, right) => (Number(right.data().dueAmount) || 0) - (Number(left.data().dueAmount) || 0));
  const startIndex = cursor ? Math.max(0, filteredDocs.findIndex((doc) => doc.id === cursor) + 1) : 0;
  const pageDocs = filteredDocs.slice(startIndex, startIndex + pageSize);
  const nextCursor = startIndex + pageSize < filteredDocs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

  const byClass = new Map<string, { className: string; studentCount: number; totalDue: number; students: { id: string; name: string; phone: string; parentName: string; due: number }[] }>();
  let grandTotalDue = 0;

  // Legacy summaries may lack phone — backfill from student docs in one batch.
  const missingIds = pageDocs
    .filter((doc) => !doc.data().phone)
    .map((doc) => String(doc.data().studentId || doc.id))
    .filter(Boolean);
  const studentById = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < missingIds.length; i += 30) {
    const refs = missingIds.slice(i, i + 30).map((id) => db.collection("students").doc(id));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => { if (s.exists) studentById.set(s.id, s.data() || {}); });
  }

  pageDocs.forEach((d) => {
    const s = d.data();
    const due = Math.max(0, Number(s.dueAmount) || 0);
    if (due <= 0) return;
    grandTotalDue += due;
    const cls = String(s.className || s.classId || "—");
    const entry = byClass.get(cls) ?? { className: cls, studentCount: 0, totalDue: 0, students: [] };
    const student = studentById.get(String(s.studentId || d.id)) || {};
    entry.studentCount += 1;
    entry.totalDue += due;
    entry.students.push({
      id: String(s.studentId || d.id),
      name: String(s.studentName || student.studentName || ""),
      phone: String(s.phone || student.phone || student.fatherPhone || ""),
      parentName: String(s.fatherName || student.fatherName || student.motherName || ""),
      due
    });
    byClass.set(cls, entry);
  });

  const classes = Array.from(byClass.values()).sort((a, b) => a.className.localeCompare(b.className));
  return NextResponse.json({ ok: true, classes, grandTotalDue, studentsWithDues: classes.reduce((n, c) => n + c.studentCount, 0), pageSize, nextCursor, hasMore: Boolean(nextCursor), truncated: Boolean(nextCursor) });
}
