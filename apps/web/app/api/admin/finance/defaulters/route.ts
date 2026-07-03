import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

// GET /api/admin/finance/defaulters?class=X – students with outstanding dues.
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  const branchId = searchParams.get("branchId") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 50, 100);
  const cursor = docCursor(searchParams.get("cursor"));

  const db = adminDb();
  let query: any = db.collection("studentFeeSummaries").where("dueAmount", ">", 0);
  if (branchId) query = query.where("branchId", "==", branchId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (classFilter) query = query.where("classId", "==", classFilter);
  if (sectionFilter) query = query.where("sectionId", "==", sectionFilter);
  query = query.orderBy("dueAmount", "desc").limit(pageSize);
  if (cursor) {
    const cursorDoc = await db.collection("studentFeeSummaries").doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.get();
  logFirestoreRead("FinanceDefaultersAPI", "studentFeeSummaries", snap, { branchId, academicYearId, classFilter, sectionFilter, pageSize });
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

  const nextCursor = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1].id : null;
  return NextResponse.json({ ok: true, data: defaulterList, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}
