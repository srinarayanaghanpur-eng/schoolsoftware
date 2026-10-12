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
