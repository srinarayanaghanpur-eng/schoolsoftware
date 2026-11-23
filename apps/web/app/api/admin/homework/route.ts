import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { homeworkCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getParentUidsForClass, sendPushToUsers } from "@/lib/push/sendPush";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

const COLLECTION = "homework";

const homeworkFilterSchema = z.object({
  className: z.string().max(200).optional(),
  subject: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  academicYearId: z.string().max(100).optional()
});

export async function GET(req: Request) {
  const token = await requirePermission(req, "exams.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const filters = homeworkFilterSchema.parse({
    className: searchParams.get("className") ?? undefined,
    subject: searchParams.get("subject") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    academicYearId: searchParams.get("academicYearId") ?? undefined
  });
  const className = filters.className ?? "";
  const subject = filters.subject ?? "";
  const status = filters.status ?? "";
  const academicYearId = filters.academicYearId ?? "";
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

  let snapshot: FirebaseFirestore.QuerySnapshot;
  try {
    snapshot = await query.limit(pageSize + 1).get();
  } catch (error: unknown) {
    const code = (error as { code?: number })?.code;
    const message = error instanceof Error ? error.message : String(error);
    if (code !== 9 && !/FAILED_PRECONDITION|requires an index/i.test(message)) throw error;

    // Missing composite index: keep every equality filter, sort and paginate in
    // memory so homework still loads while the index builds.
    let fallback: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (academicYearId) fallback = fallback.where("academicYearId", "==", academicYearId);
    const broad = await fallback.limit(1000).get();
    let docs = broad.docs.filter((doc) => {
      const data = doc.data() as Record<string, unknown>;
      if (className && String(data.className ?? "") !== className) return false;
      if (subject && String(data.subject ?? "") !== subject) return false;
      if (status && String(data.status ?? "") !== status) return false;
      return true;
    });
    docs.sort((a, b) => String(b.data().dueDate ?? "").localeCompare(String(a.data().dueDate ?? "")));
    if (cursor) {
      const index = docs.findIndex((doc) => doc.id === cursor);
      if (index >= 0) docs = docs.slice(index + 1);
    }
    const pageDocs = docs.slice(0, pageSize);
    const nextCursor = docs.length > pageSize ? pageDocs[pageDocs.length - 1]?.id ?? null : null;
    logFirestoreRead("HomeworkAPI", COLLECTION, broad, { className, subject, status, fallback: true });
    return json({
      ok: true,
      homework: pageDocs.map((doc) => serializeDoc(doc)),
      pageSize,
      nextCursor,
      hasMore: Boolean(nextCursor)
    });
  }

  logFirestoreRead("HomeworkAPI", COLLECTION, snapshot, { className, subject, status });
  const pageDocs = snapshot.docs.slice(0, pageSize);
  const homework = pageDocs.map((doc) => serializeDoc(doc));
  const nextCursor = snapshot.docs.length > pageSize ? pageDocs[pageDocs.length - 1].id : null;

  return json({ ok: true, homework, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "exams.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `homework-create:${token.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 16 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = homeworkCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      assignedBy: token.uid,
      createdAt: now,
      updatedAt: now,
    });
    // Push to parents of the target class/section — fire-and-forget, never
    // blocks or fails this write.
    void notifyHomeworkParents(parsed).catch(() => undefined);
    return json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create homework";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

async function notifyHomeworkParents(input: {
  className: string;
  section?: string;
  academicYearId?: string;
  subject: string;
  title: string;
}): Promise<void> {
  const uids = await getParentUidsForClass(
    input.className,
    input.section || undefined,
    input.academicYearId || undefined
  );
  if (uids.length === 0) return;
  const where = input.section ? `Class ${input.className}${input.section}` : `Class ${input.className}`;
  await sendPushToUsers(uids, {
    category: "homework",
    title: "New homework",
    body: `${input.subject}: ${input.title} (${where})`,
    route: "/parent/homework"
  });
}
