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
    const studentId = url.searchParams.get("studentId")?.trim() || "";
    if (!studentId) {
      return NextResponse.json({ ok: false, error: "studentId is required" }, { status: 400 });
    }
    const academicYearId = url.searchParams.get("academicYearId") || "";
    const pageSize = readLimit(url.searchParams.get("pageSize"), 25, 100);
    const cursor = url.searchParams.get("cursor")?.trim() || "";

    const db = adminDb();

    const studentSnap = await db.collection("students").doc(studentId).get();
    const studentInfo: Record<string, string> = {};
    if (studentSnap.exists) {
      const s = studentSnap.data() as Record<string, unknown>;
      studentInfo.studentName = String(s.studentName || "");
      studentInfo.admissionNumber = String(s.admissionNumber || "");
      studentInfo.className = String(s.className || s.class || "");
      studentInfo.section = String(s.section || "");
      studentInfo.parentName = String(s.parentName || "");
      studentInfo.parentMobile = String(s.parentMobile || "");
    }

    let query: FirebaseFirestore.Query = db.collection(COLLECTION)
      .where("studentId", "==", studentId);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);

    const snapshot = await query.limit(500).get();
    logFirestoreRead("FeeReminderHistoryAPI", COLLECTION, snapshot, { studentId, academicYearId, pageSize });

    const docs = [...snapshot.docs].sort((a, b) => timeValue(b.data().createdAt) - timeValue(a.data().createdAt));

    const startIndex = cursor ? Math.max(0, docs.findIndex((doc) => doc.id === cursor) + 1) : 0;
    const pageDocs = docs.slice(startIndex, startIndex + pageSize);
    const history = pageDocs.map((doc) => serializeDoc(doc));
    const nextCursor = startIndex + pageSize < docs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;

    return NextResponse.json({ ok: true, history, studentInfo, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
