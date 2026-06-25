import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";

// GET /api/admin/finance/reminders — build the fee-reminder list (students with dues + contact).
export async function GET(req: Request) {
  const token = await requirePermission(req, "fees.view");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection("students").get();
  const reminders = snap.docs
    .map((d) => {
      const s = d.data();
      const due = Math.max(0, (Number(s.totalFeesDue) || 0) - (Number(s.totalFeesPaid) || 0));
      return { studentId: d.id, name: String(s.studentName || ""), className: String(s.class || ""), phone: String(s.phone || ""), due };
    })
    .filter((r) => r.due > 0)
    .sort((a, b) => b.due - a.due);

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
