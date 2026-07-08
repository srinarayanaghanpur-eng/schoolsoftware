import { FieldValue } from "firebase-admin/firestore";
import { feeStructureCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "fee_structures";

// GET /api/admin/fee-structures?academicYearId=&className=&schoolId=&pageSize=&cursor=
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId") || "";
    const className = searchParams.get("className") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = searchParams.get("cursor")?.trim() || "";

    const db = adminDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    else if (schoolId) query = query.where("schoolId", "==", schoolId);

    const snapshot = await query.limit(500).get();
    logFirestoreRead("FeeStructuresAPI", COLLECTION, snapshot, { academicYearId, className, schoolId, pageSize });

    const filtered = snapshot.docs
      .map((doc) => serializeDoc(doc))
      .filter((structure) => !academicYearId || String(structure.academicYearId || "") === academicYearId)
      .filter((structure) => !className || String(structure.className || "") === className)
      .filter((structure) => !schoolId || String(structure.schoolId || "") === schoolId)
      .sort((left, right) => String(left.className || "").localeCompare(String(right.className || ""), undefined, { numeric: true }));

    const startIndex = cursor ? Math.max(0, filtered.findIndex((item) => item.id === cursor) + 1) : 0;
    const pageDocs = filtered.slice(startIndex, startIndex + pageSize);
    const nextCursor = startIndex + pageSize < filtered.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
    return json({ ok: true, structures: pageDocs, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load fee structures";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

// POST /api/admin/fee-structures — create class-wise fee structure (total computed).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = feeStructureCreateSchema.parse(await req.json());
    const total = parsed.heads.reduce((sum, h) => sum + h.amount, 0);
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, schoolId: getSchoolId(token), total, createdAt: now, updatedAt: now });
    return json({ ok: true, id: ref.id, total });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create fee structure";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

