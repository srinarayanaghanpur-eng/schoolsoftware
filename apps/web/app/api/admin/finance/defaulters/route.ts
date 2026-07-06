import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
// GET /api/admin/finance/defaulters?class=X – students with outstanding dues.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  const branchId = searchParams.get("branchId") || "";
  const schoolId = searchParams.get("schoolId") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
  const cursor = searchParams.get("cursor")?.trim() || "";

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries");
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  else if (schoolId) query = query.where("schoolId", "==", schoolId);
  const snap = await query.limit(1000).get();
  logFirestoreRead("FinanceDefaultersAPI", "studentFeeSummaries", snap, { schoolId, branchId, academicYearId, classFilter, sectionFilter, pageSize });
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

  const filteredDocs = snap.docs
    .filter((doc) => {
      const data = doc.data();
      return (Number(data.dueAmount) || 0) > 0
        && (!schoolId || String(data.schoolId || "") === schoolId)
        && (!branchId || String(data.branchId || "") === branchId)
        && (!academicYearId || String(data.academicYearId || "") === academicYearId)
        && (!classFilter || String(data.classId || data.className || "") === classFilter)
        && (!sectionFilter || String(data.sectionId || data.sectionName || "") === sectionFilter);
    })
    .sort((left, right) => (Number(right.data().dueAmount) || 0) - (Number(left.data().dueAmount) || 0));
  const startIndex = cursor ? Math.max(0, filteredDocs.findIndex((doc) => doc.id === cursor) + 1) : 0;
  const pageDocs = filteredDocs.slice(startIndex, startIndex + pageSize);
  pageDocs.forEach((d: any) => {
    const s = d.data();
    const totalDue = Math.max(0, Number(s.dueAmount) || 0);
    if (totalDue <= 0) return;

    const lastDate = s.lastPaymentDate?.toDate?.().toISOString() || s.lastPaymentDate || null;
    const daysOverdue = lastDate
      ? Math.floor((today.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    defaulterList.push({
      id: String(s.studentId || d.id),
      studentName: String(s.studentName || ""),
      className: String(s.className || s.classId || "—"),
      admissionNumber: String(s.admissionNumber || ""),
      totalDue,
      lastPaymentDate: lastDate,
      daysOverdue
    });
  });

  const nextCursor = startIndex + pageSize < filteredDocs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
  return NextResponse.json({ ok: true, data: defaulterList, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}
