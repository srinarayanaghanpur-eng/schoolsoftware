import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

// GET /api/admin/finance/reminders — build the fee-reminder list (students with dues + contact).
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 25, 250);
  const cursor = searchParams.get("cursor")?.trim() || "";
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  const academicYearId = searchParams.get("academicYearId") || "";
  const schoolId = searchParams.get("schoolId") || "";
  const db = adminDb();

  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries");
  if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
  else if (schoolId) query = query.where("schoolId", "==", schoolId);

  const snap = await query.limit(1000).get();
  logFirestoreRead("FinanceRemindersAPI", "studentFeeSummaries", snap, { schoolId, academicYearId, classFilter, sectionFilter, pageSize });
  const filteredDocs = snap.docs
    .filter((doc) => {
      const data = doc.data();
      return (Number(data.dueAmount) || 0) > 0
        && (!schoolId || String(data.schoolId || "") === schoolId)
        && (!academicYearId || String(data.academicYearId || "") === academicYearId)
        && (!classFilter || String(data.classId || data.className || "") === classFilter)
        && (!sectionFilter || String(data.sectionId || data.sectionName || "") === sectionFilter);
    })
    .sort((left, right) => (Number(right.data().dueAmount) || 0) - (Number(left.data().dueAmount) || 0));
  const startIndex = cursor ? Math.max(0, filteredDocs.findIndex((doc) => doc.id === cursor) + 1) : 0;
  const pageDocs = filteredDocs.slice(startIndex, startIndex + pageSize);
  const nextCursor = startIndex + pageSize < filteredDocs.length && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
  // Summaries written since the fee-summary rollout carry name/class/phone, so
  // only fall back to the student doc for legacy summaries missing them.
  const missingIds = pageDocs
    .filter((doc) => !doc.data().studentName || !doc.data().phone)
    .map((doc) => String(doc.data().studentId || ""))
    .filter(Boolean);
  const studentById = new Map<string, FirebaseFirestore.DocumentData>();
  if (missingIds.length > 0) {
    const studentSnaps = await db.getAll(...missingIds.map((id) => db.collection("students").doc(id)));
    studentSnaps.forEach((doc) => {
      if (doc.exists) studentById.set(doc.id, doc.data() ?? {});
    });
  }

  const reminders = pageDocs.map((d) => {
    const summary = d.data();
    const studentId = String(summary.studentId || "");
    const student = studentById.get(studentId) ?? {};
    return {
      studentId,
      name: String(summary.studentName || student.studentName || ""),
      className: String(summary.className || summary.classId || student.class || ""),
      phone: String(summary.phone || student.phone || student.fatherPhone || ""),
      due: Math.max(0, Number(summary.dueAmount) || 0)
    };
  });

  return NextResponse.json({ ok: true, reminders, count: reminders.length, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
}

// POST /api/admin/finance/reminders — record reminders as "sent" (queued for WhatsApp/Email provider).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
    const channel: string = body?.channel || "whatsapp";
    const academicYearId = String(body?.academicYearId ?? "").trim();
    const schoolId = String(body?.schoolId ?? getSchoolId(token));
    if (studentIds.length === 0) return NextResponse.json({ ok: false, error: "No students selected" }, { status: 400 });

    const db = adminDb();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    studentIds.forEach((sid) => {
      const ref = db.collection("fee_reminders").doc();
      // delivery is left to the WhatsApp/Email provider integration; we record the intent.
      batch.set(ref, { studentId: sid, academicYearId, schoolId, channel, status: "queued", sentBy: token.uid, createdAt: now });
    });
    await batch.commit();
    return NextResponse.json({ ok: true, queued: studentIds.length, channel });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to queue reminders" }, { status: 400 });
  }
}
