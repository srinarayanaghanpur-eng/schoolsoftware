import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const schoolId = searchParams.get("schoolId") || "";
  // Default 25 for list views; exports/reports may request more explicitly (up to 1000).
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 1000);
  const cursor = docCursor(searchParams.get("cursor"));
  const db = adminDb();

  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries").where("dueAmount", ">", 0);
  if (schoolId) query = query.where("schoolId", "==", schoolId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (classFilter) query = query.where("classId", "==", classFilter);
  if (sectionFilter) query = query.where("sectionId", "==", sectionFilter);
  query = query.orderBy("dueAmount", "desc");

  if (cursor) {
    const cursorDoc = await db.collection("studentFeeSummaries").doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  query = query.limit(pageSize + 1);

  const summarySnap = await query.get();
  logFirestoreRead("FinanceReceivablesAPI", "studentFeeSummaries", summarySnap, { schoolId, academicYearId, classFilter, sectionFilter, pageSize });
  const pageDocs = summarySnap.docs.slice(0, pageSize);
  const nextCursor = summarySnap.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
  const students = pageDocs.map((d) => ({ id: d.id, ...d.data() }));

  const receivables = students
    .map((s: Record<string, unknown>) => {
      const due = Math.max(0, Number(s.dueAmount) || 0);
      return {
        id: s.studentId || s.id,
        studentName: String(s.studentName || s.name || ""),
        className: String(s.className || s.classId || ""),
        admissionNumber: String(s.admissionNumber || ""),
        totalFees: Number(s.totalFee || 0),
        paid: Number(s.totalPaid || 0),
        due,
        lastPaymentDate: s.lastPaymentDate ? String(s.lastPaymentDate) : null,
        feeStatus: due > 0 ? "pending" : "paid"
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
    students: receivables,
    pageSize,
    nextCursor,
    hasMore: Boolean(nextCursor)
  });
}
