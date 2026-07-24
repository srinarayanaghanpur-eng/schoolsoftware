import { FieldValue } from "firebase-admin/firestore";
import { timetableEntryCreateSchema, timetableBulkCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

const COLLECTION = "timetable";

export async function GET(req: Request) {
  const token = await requirePermission(req, "academics.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const className = searchParams.get("className") || "";
  const section = searchParams.get("section") || "";
  const dayOfWeek = searchParams.get("dayOfWeek") || "";
  const academicYearId = searchParams.get("academicYearId") || "";

  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);

  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  if (className) query = query.where("className", "==", className);
  if (section) query = query.where("section", "==", section);
  if (dayOfWeek) query = query.where("dayOfWeek", "==", Number(dayOfWeek));

  query = query.orderBy("dayOfWeek").orderBy("periodNumber");

  const snapshot = await query.get();
  logFirestoreRead("TimetableAPI", COLLECTION, snapshot, { className, section, dayOfWeek });
  const entries = snapshot.docs.map((doc) => serializeDoc(doc));

  return json({ ok: true, entries });
}

export async function POST(req: Request) {
  const token = await requirePermission(req, "academics.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const db = adminDb();
    const now = FieldValue.serverTimestamp();

    if (Array.isArray(body.entries)) {
      const parsed = timetableBulkCreateSchema.parse(body);
      const { entries, replaceExisting } = parsed;

      if (replaceExisting && entries.length > 0) {
        const existing = await db.collection(COLLECTION)
          .where("className", "==", entries[0].className)
          .where("section", "==", entries[0].section || "")
          .where("academicYearId", "==", entries[0].academicYearId)
          .get();

        const batch = db.batch();
        existing.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }

      const batch = db.batch();
      const refs: string[] = [];
      for (const entry of entries) {
        const ref = db.collection(COLLECTION).doc();
        batch.set(ref, { ...entry, createdAt: now, updatedAt: now });
        refs.push(ref.id);
      }
      await batch.commit();
      return json({ ok: true, ids: refs, count: entries.length });
    }

    const parsed = timetableEntryCreateSchema.parse(body);
    const ref = await db.collection(COLLECTION).add({ ...parsed, createdAt: now, updatedAt: now });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create timetable entry";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
