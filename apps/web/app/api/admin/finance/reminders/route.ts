import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

// GET /api/admin/finance/reminders — build the fee-reminder list (students with dues + contact).
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const pageSize = readLimit(searchParams.get("pageSize") ?? searchParams.get("limit"), 100, 250);
  const classFilter = searchParams.get("classId") || searchParams.get("class") || "";
  const sectionFilter = searchParams.get("sectionId") || searchParams.get("section") || "";
  const db = adminDb();

  let query: FirebaseFirestore.Query = db.collection("studentFeeSummaries").where("dueAmount", ">", 0);
  if (classFilter) query = query.where("classId", "==", classFilter);
  if (sectionFilter) query = query.where("sectionId", "==", sectionFilter);
  query = query.orderBy("dueAmount", "desc").limit(pageSize);

  const snap = await query.get();
  logFirestoreRead("FinanceRemindersAPI", "studentFeeSummaries", snap, { classFilter, sectionFilter, pageSize });
  // Summaries written since the fee-summary rollout carry name/class/phone, so
  // only fall back to the student doc for legacy summaries missing them.
  const missingIds = snap.docs
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

  const reminders = snap.docs.map((d) => {
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

  return NextResponse.json({ ok: true, reminders, count: reminders.length });
}

// POST /api/admin/finance/reminders — record reminders as "sent" (queued for SMS/WhatsApp provider).
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const studentIds: string[] = Array.isArray(body?.studentIds) ? body.studentIds : [];
    const channel: string = body?.channel || "sms";
    if (studentIds.length === 0) return NextResponse.json({ ok: false, error: "No students selected" }, { status: 400 });

    const db = adminDb();
    const now = FieldValue.serverTimestamp();
    const batch = db.batch();
    studentIds.forEach((sid) => {
      const ref = db.collection("fee_reminders").doc();
      // delivery is left to the SMS/WhatsApp provider integration; we record the intent.
      batch.set(ref, { studentId: sid, channel, status: "queued", sentBy: token.uid, createdAt: now });
    });
    await batch.commit();
    return NextResponse.json({ ok: true, queued: studentIds.length, channel });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to queue reminders" }, { status: 400 });
  }
}
