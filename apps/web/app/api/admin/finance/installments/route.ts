import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { installmentPlanCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "installment_plans";

// GET /api/admin/finance/installments?studentId=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);
  const studentId = searchParams.get("studentId");
  const academicYearId = searchParams.get("academicYearId") || "";
  const schoolId = searchParams.get("schoolId") || "";
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
  const cursor = docCursor(searchParams.get("cursor"));
  if (studentId) query = query.where("studentId", "==", studentId);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (schoolId) query = query.where("schoolId", "==", schoolId);
  query = query.orderBy("createdAt", "desc");

  if (cursor) {
    const cursorDoc = await db.collection(COLLECTION).doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snap = await query.limit(pageSize + 1).get();
  logFirestoreRead("FinanceInstallmentsAPI", COLLECTION, snap, { studentId, academicYearId, schoolId, pageSize });
  const pageDocs = snap.docs.slice(0, pageSize);
  const plans = pageDocs.map((d) => serializeDoc(d));
  const nextCursor = snap.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
  return NextResponse.json({ ok: true, plans, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}

// POST /api/admin/finance/installments — create a new installment plan.
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = installmentPlanCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();

    const studentSnap = await adminDb().collection("students").doc(parsed.studentId).get();
    const studentData = studentSnap.data();
    const studentName = String(studentData?.studentName ?? "");

    const doc = {
      ...parsed,
      studentName,
      schoolId: String(studentData?.schoolId ?? getSchoolId(token)),
      paidAmount: 0,
      createdBy: token.uid,
      createdAt: now,
      updatedAt: now
    };

    const ref = await adminDb().collection(COLLECTION).add(doc);
    return NextResponse.json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create installment plan";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
