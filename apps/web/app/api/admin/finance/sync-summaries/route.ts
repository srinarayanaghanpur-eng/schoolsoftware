import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { logFirestoreRead } from "@/lib/firestoreReadLogger";

// POST /api/admin/finance/sync-summaries
// Rebuilds studentFeeSummaries from the students collection for one academic
// year. Fixes students admitted before the summary rollout (or created without
// a summary) who otherwise never appear in dues/reminders/defaulters.
// Bounded: max 500 students per call; returns processed count.
export async function POST(req: Request) {
  const token = await requirePermission(req, "fees.create");
  if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const academicYearId = String(body?.academicYearId ?? "").trim();
  if (!academicYearId) {
    return NextResponse.json({ ok: false, error: "academicYearId is required" }, { status: 400 });
  }

  const db = adminDb();
  const snap = await db.collection("students")
    .where("academicYearId", "==", academicYearId)
    .limit(500)
    .get();
  logFirestoreRead("SyncFeeSummariesAPI", "students", snap, { academicYearId });

  let writer = db.batch();
  let inBatch = 0;
  let synced = 0;
  const now = new Date();

  for (const doc of snap.docs) {
    const s = doc.data();
    if (String(s.status || "active") !== "active") continue;
    const totalFee = Number(s.totalFeeAmount || 0);
    const totalPaid = Number(s.totalFeesPaid || 0);
    const totalConcession = Number(s.totalConcessionAmount || 0);
    const dueAmount = Math.max(0, Number(s.totalFeesDue ?? (totalFee - totalPaid - totalConcession)) || 0);
    const feeStatus: "paid" | "partial" | "pending" = dueAmount <= 0 ? "paid" : totalPaid > 0 ? "partial" : "pending";

    const ref = db.collection("studentFeeSummaries").doc(`${doc.id}_${academicYearId}`);
    writer.set(ref, {
      studentId: doc.id,
      schoolId: String(s.schoolId || "default-school"),
      branchId: String(s.branchId || "default-branch"),
      academicYearId,
      classId: String(s.classId || s.class || ""),
      sectionId: String(s.sectionId || s.section || ""),
      studentName: String(s.studentName || ""),
      admissionNumber: String(s.admissionNumber || ""),
      phone: String(s.phone || s.fatherPhone || ""),
      className: String(s.class || s.classId || ""),
      sectionName: String(s.section || s.sectionId || ""),
      totalFee,
      totalPaid,
      totalConcession,
      dueAmount,
      feeStatus,
      updatedAt: now
    }, { merge: true });
    synced += 1;
    inBatch += 1;
    if (inBatch >= 400) {
      await writer.commit();
      writer = db.batch();
      inBatch = 0;
    }
  }
  if (inBatch > 0) await writer.commit();

  return NextResponse.json({ ok: true, synced, scanned: snap.size, truncated: snap.size >= 500 });
}
