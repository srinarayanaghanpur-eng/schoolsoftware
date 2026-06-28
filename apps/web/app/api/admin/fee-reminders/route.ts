import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { feeReminderCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { writeAuditLog } from "@/lib/auditLog";

const COLLECTION = "fee_reminders";

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, "fees.view");
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");

    let query: FirebaseFirestore.Query = adminDb().collection(COLLECTION);
    if (studentId) query = query.where("studentId", "==", studentId);

    const snapshot = await query.orderBy("createdAt", "desc").limit(100).get();
    const reminders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ ok: true, reminders });
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

    const now = FieldValue.serverTimestamp();
    const ref = await db.collection(COLLECTION).add({
      studentId: parsed.studentId,
      studentName: student.studentName ?? "",
      className: student.class ?? "",
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
