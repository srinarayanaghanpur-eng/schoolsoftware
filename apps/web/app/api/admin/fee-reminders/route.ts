import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { feeReminderCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";
import { docCursor, logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "fee_reminders";

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, "fees.view");
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    const academicYearId = url.searchParams.get("academicYearId") || "";
    const schoolId = url.searchParams.get("schoolId") || "";
    const pageSize = readLimit(url.searchParams.get("pageSize") ?? url.searchParams.get("limit"), 25, 100);
    const cursor = docCursor(url.searchParams.get("cursor"));

    const db = adminDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTION);
    if (studentId) query = query.where("studentId", "==", studentId);
    if (academicYearId) query = query.where("academicYearId", "==", academicYearId);
    if (schoolId) query = query.where("schoolId", "==", schoolId);
    query = query.orderBy("createdAt", "desc");

    if (cursor) {
      const cursorDoc = await db.collection(COLLECTION).doc(cursor).get();
      if (cursorDoc.exists) query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.limit(pageSize + 1).get();
    logFirestoreRead("FeeRemindersAPI", COLLECTION, snapshot, { studentId, academicYearId, schoolId, pageSize });
    const pageDocs = snapshot.docs.slice(0, pageSize);
    const reminders = pageDocs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const nextCursor = snapshot.docs.length > pageSize && pageDocs.length > 0 ? pageDocs[pageDocs.length - 1].id : null;
    return NextResponse.json({ ok: true, reminders, pageSize, nextCursor, hasMore: Boolean(nextCursor) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load reminders";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, "fees.create");
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const parsed = feeReminderCreateSchema.parse(body);

    const db = adminDb();
    const studentSnap = await db.collection("students").doc(parsed.studentId).get();
    if (!studentSnap.exists) {
      return NextResponse.json({ ok: false, error: "Student not found" }, { status: 404 });
    }
    const student = studentSnap.data() as Record<string, unknown>;
    const academicYearId = String(body.academicYearId ?? student.academicYearId ?? "").trim();
    const schoolId = String(student.schoolId ?? getSchoolId(token));

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      studentId: parsed.studentId,
      studentName: student.studentName ?? "",
      className: student.class ?? "",
      academicYearId,
      schoolId,
      amount: parsed.amount,
      dueDate: parsed.dueDate,
      note: parsed.note ?? "",
      sent: false,
      createdBy: token.uid,
      createdAt: now
    });

    await writeAuditLog({
      action: "fee_reminder.created",
      entityType: "fee_reminder",
      entityId: ref.id,
      actorId: token.uid,
      actorRole: token.role as string,
      newValues: { studentId: parsed.studentId, amount: parsed.amount, dueDate: parsed.dueDate }
    });

    return NextResponse.json({ ok: true, id: ref.id, message: "Fee reminder created." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create reminder";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
