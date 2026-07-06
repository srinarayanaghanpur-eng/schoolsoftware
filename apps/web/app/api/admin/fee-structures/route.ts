import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { feeStructureCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "fee_structures";

// GET /api/admin/fee-structures?academicYearId=&className=&schoolId=&pageSize=&cursor=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const academicYearId = searchParams.get("academicYearId") || "";
  const className = searchParams.get("className") || "";
  const schoolId = searchParams.get("schoolId") || getSchoolId(token);
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
  const cursor = docCursor(searchParams.get("cursor"));

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (className) query = query.where("className", "==", className);
  if (schoolId) query = query.where("schoolId", "==", schoolId);
  query = query.orderBy("className", "asc");

  if (cursor) {
    const cursorDoc = await db.collection(COLLECTION).doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snapshot = await query.limit(pageSize + 1).get();
  logFirestoreRead("FeeStructuresAPI", COLLECTION, snapshot, { academicYearId, className, schoolId, pageSize });
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const structures = pageDocs.map((doc) => serializeDoc(doc));
  const nextCursor = snapshot.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
  return NextResponse.json({ ok: true, structures, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}

// POST /api/admin/fee-structures — create class-wise fee structure (total computed).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = feeStructureCreateSchema.parse(await req.json());
    const total = parsed.heads.reduce((sum, h) => sum + h.amount, 0);
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, schoolId: getSchoolId(token), total, createdAt: now, updatedAt: now });
    return NextResponse.json({ ok: true, id: ref.id, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create fee structure";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
