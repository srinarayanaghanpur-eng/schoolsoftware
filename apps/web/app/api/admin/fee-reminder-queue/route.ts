import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, errorMessage, json } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";


const COLLECTION = "fee_reminder_queue";

function timeValue(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, "fees.view");
    if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

    const url = new URL(req.url);
    const academicYearId = url.searchParams.get("academicYearId") || "";
    const status = url.searchParams.get("status") || "";
    const channel = url.searchParams.get("channel") || "";
    const studentId = url.searchParams.get("studentId") || "";
    const className = url.searchParams.get("className") || "";
    const pageSize = readLimit(url.searchParams.get("pageSize"), 25, 100);
    const cursor = url.searchParams.get("cursor")?.trim() || "";
    const schoolId = url.searchParams.get("schoolId")?.trim() || getSchoolId(token);

    const db = adminDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (status) query = query.where("status", "==", status);
    if (channel) query = query.where("channel", "==", channel);
    if (studentId) query = query.where("studentId", "==", studentId);
    if (className) query = query.where("className", "==", className);

    const snapshot = await query.limit(500).get();
    logFirestoreRead("FeeReminderQueueAPI", COLLECTION, snapshot, { academicYearId, status, channel, studentId, className, pageSize });

    const docs = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        return !schoolId || String(data.schoolId || "") === schoolId;
      })
      .sort((a, b) => timeValue(b.data().createdAt) - timeValue(a.data().createdAt));

    const startIndex = cursor ? Math.max(0, docs.findIndex((doc) => doc.id === cursor) + 1) : 0;
    const pageDocs = docs.slice(startIndex, startIndex + pageSize);
    const items = pageDocs.map((doc) => serializeDoc(doc));
    const nextCursor = startIndex + pageSize < docs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return json({ ok: true, items, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const token = await requirePermission(req, "fees.edit");
    if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

    const { ids, status, reason } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return json({ ok: false, error: "ids and status are required" }, { status: 400 });
    }

    const db = adminDb();
    for (const id of ids) {
      const updateData: Record<string, unknown> = { status, updatedAt: FieldValue.serverTimestamp() };
      if (reason !== undefined) updateData.reason = reason;
      await db.collection(COLLECTION).doc(id).update(updateData);
    }

    return json({ ok: true, updated: ids.length });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}

