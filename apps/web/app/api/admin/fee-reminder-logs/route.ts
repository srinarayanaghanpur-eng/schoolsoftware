import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, errorMessage } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";


const COLLECTION = "fee_reminder_logs";

function timeValue(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, "fees.view");
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const url = new URL(req.url);
    const academicYearId = url.searchParams.get("academicYearId") || "";
    const studentId = url.searchParams.get("studentId") || "";
    const channel = url.searchParams.get("channel") || "";
    const status = url.searchParams.get("status") || "";
    const dateFrom = url.searchParams.get("dateFrom") || "";
    const dateTo = url.searchParams.get("dateTo") || "";
    const pageSize = readLimit(url.searchParams.get("pageSize"), 25, 100);
    const cursor = url.searchParams.get("cursor")?.trim() || "";
    const schoolId = url.searchParams.get("schoolId")?.trim() || getSchoolId(token);

    const db = adminDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (studentId) query = query.where("studentId", "==", studentId);
    if (channel) query = query.where("channel", "==", channel);
    if (status) query = query.where("status", "==", status);

    const snapshot = await query.limit(500).get();
    logFirestoreRead("FeeReminderLogsAPI", COLLECTION, snapshot, { academicYearId, studentId, channel, status, dateFrom, dateTo, pageSize });

    let docs = snapshot.docs
      .filter((doc) => {
        const data = doc.data();
        return !schoolId || String(data.schoolId || "") === schoolId;
      })
      .sort((a, b) => timeValue(b.data().createdAt) - timeValue(a.data().createdAt));

    if (dateFrom || dateTo) {
      const fromTime = dateFrom ? new Date(dateFrom).getTime() : 0;
      const toTime = dateTo ? new Date(dateTo).getTime() + 86400000 : Infinity;
      docs = docs.filter((doc) => {
        const data = doc.data();
        const sentAt = data.sentAt || data.createdAt;
        if (!sentAt) return false;
        let t: number;
        if (typeof sentAt === "object" && "toDate" in sentAt) {
          t = sentAt.toDate().getTime();
        } else if (sentAt instanceof Date) {
          t = sentAt.getTime();
        } else {
          t = new Date(String(sentAt)).getTime();
        }
        return !isNaN(t) && t >= fromTime && t <= toTime;
      });
    }

    const startIndex = cursor ? Math.max(0, docs.findIndex((doc) => doc.id === cursor) + 1) : 0;
    const pageDocs = docs.slice(startIndex, startIndex + pageSize);
    const logs = pageDocs.map((doc) => serializeDoc(doc));
    const nextCursor = startIndex + pageSize < docs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return NextResponse.json({ ok: true, logs, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
