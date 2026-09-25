import { FieldValue } from "firebase-admin/firestore";
import { examCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "exams";

// GET /api/admin/exams?academicYearId=&className=&schoolId=&pageSize=&cursor=
// Lists exams with cursor pagination (default 25 rows), newest first.
export async function GET(req: Request) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId") || "";
    const className = searchParams.get("className") || "";
    const schoolId = searchParams.get("schoolId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    const db = adminDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (className) query = query.where("className", "==", className);
    if (schoolId) query = query.where("schoolId", "==", schoolId);
    query = query.orderBy("startDate", "desc");

    if (cursor) {
      const cursorDoc = await db.collection(COLLECTION).doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    let snapshot;
    let degraded = false;
    try {
      snapshot = await query.limit(pageSize + 1).get();
    } catch (queryError: unknown) {
      // Missing composite index (academicYearId + startDate): fall back to a
      // bounded unordered read with in-memory sort so the page keeps working.
      const code = String((queryError as { code?: unknown })?.code ?? "");
      const message = queryError instanceof Error ? queryError.message : String(queryError);
      if (code !== "9" && !/FAILED_PRECONDITION|requires an index/i.test(message)) throw queryError;
      console.error(`[ExamsAPI] Missing Firestore index — degraded unordered query used. Create it via this link:\n${message}`);
      let fallback: FirebaseFirestore.Query = db.collection(COLLECTION);
      if (academicYearId) fallback = fallback.where("academicYearId", "==", academicYearId);
      if (className) fallback = fallback.where("className", "==", className);
      if (schoolId) fallback = fallback.where("schoolId", "==", schoolId);
      snapshot = await fallback.limit(Math.min(pageSize * 4, 200)).get();
      degraded = true;
    }
    logFirestoreRead("ExamsAPI", COLLECTION, snapshot, { academicYearId, className, schoolId, pageSize, degraded });
    let pageDocs = snapshot.docs.slice(0, pageSize);
    if (degraded) {
      pageDocs = [...snapshot.docs]
        .sort((a, b) => String(b.data()?.startDate ?? "").localeCompare(String(a.data()?.startDate ?? "")))
        .slice(0, pageSize);
    }
    const exams = pageDocs.map((doc) => serializeDoc(doc));
    const nextCursor = !degraded && snapshot.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
    return json({ ok: true, exams, pageSize, nextCursor, hasMore: Boolean(nextCursor), degraded });
  } catch (error) {
    console.error("[ExamsAPI] GET failed:", error instanceof Error ? error.message : error);
    return json({ ok: false, error: "Unable to load exams" }, { status: 500 });
  }
}

// POST /api/admin/exams — create an exam.
export async function POST(req: Request) {
  const token = await requirePermission(req, "exams.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = examCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({ ...parsed, schoolId: getSchoolId(token), createdAt: now, updatedAt: now });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create exam";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

