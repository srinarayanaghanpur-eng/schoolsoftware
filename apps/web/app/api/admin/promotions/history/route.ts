import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
const db = adminDb();

export async function GET(req: Request) {
  const token = await requirePermission(req, "promotions.view");
  if (!token) {
    return json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId");
    const classStr = searchParams.get("class");
    const studentId = searchParams.get("studentId");
    // Applied-when-present: only filter by schoolId when explicitly requested,
    // so legacy docs without the field are not hidden.
    const schoolId = searchParams.get("schoolId") || "";
    const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 100);
    const cursor = docCursor(searchParams.get("cursor"));

    let query: FirebaseFirestore.Query = db.collection("promotions").orderBy("createdAt", "desc");

    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (classStr) query = query.where("fromClass", "==", classStr);
    if (studentId) query = query.where("studentId", "==", studentId);
    if (schoolId) query = query.where("schoolId", "==", schoolId);
    if (cursor) {
      const cursorDoc = await db.collection("promotions").doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.limit(pageSize + 1).get();
    logFirestoreRead("PromotionHistoryAPI", "promotions", snapshot, { schoolId, academicYearId, class: classStr, studentId, pageSize });
    const pageDocs = snapshot.docs.slice(0, pageSize);
    const records = pageDocs.map((doc) => serializeDoc(doc));
    const nextCursor = snapshot.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return json({ ok: true, records, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    console.error("Error fetching promotion history:", error);
    return json({ ok: false, error: "Failed to fetch promotion history" }, { status: 500 });
  }
}

