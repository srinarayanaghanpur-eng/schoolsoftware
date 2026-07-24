import { FieldValue } from "firebase-admin/firestore";
import { homeworkCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

const COLLECTION = "homework";

export async function GET(req: Request) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const className = searchParams.get("className") || "";
  const subject = searchParams.get("subject") || "";
  const status = searchParams.get("status") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const pageSize = readLimit(searchParams.get("pageSize"), 25, 100);
  const cursor = docCursor(searchParams.get("cursor"));

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);

  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (className) query = query.where("className", "==", className);
  if (subject) query = query.where("subject", "==", subject);
  if (status) query = query.where("status", "==", status);

  query = query.orderBy("dueDate", "desc");

  if (cursor) {
    const cursorDoc = await db.collection(COLLECTION).doc(cursor).get();
    if (cursorDoc.exists) query = query.startAfter(cursorDoc);
  }

  const snapshot = await query.limit(pageSize + 1).get();
  logFirestoreRead("HomeworkAPI", COLLECTION, snapshot, { className, subject, status });
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const homework = pageDocs.map((doc) => serializeDoc(doc));
  const nextCursor = snapshot.docs.length > pageSize ? pageDocs[pageDocs.length - 1].id : null;

  return json({ ok: true, homework, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "exams.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = homeworkCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      assignedBy: token.uid,
      createdAt: now,
      updatedAt: now,
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create homework";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
