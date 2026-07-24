import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

const STUDENTS_COLLECTION = "students";
const QUEUE_COLLECTION = "fee_reminder_queue";

function isToday(dateVal: unknown): boolean {
  if (!dateVal) return false;
  let ts: number;
  if (dateVal && typeof dateVal === "object" && "toMillis" in dateVal && typeof (dateVal as any).toMillis === "function") {
    ts = (dateVal as any).toMillis();
  } else if (dateVal instanceof Date) {
    ts = dateVal.getTime();
  } else {
    ts = new Date(String(dateVal)).getTime();
  }
  if (!Number.isFinite(ts)) return false;
  const d = new Date(ts);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

export async function GET(req: Request) {
  const token = await requirePermission(req, "fee_reminders.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const academicYearId = searchParams.get("academicYearId") || "";
    const schoolId = getSchoolId(token);
    const db = adminDb();

    const dueStudentsPromise = db
      .collection(STUDENTS_COLLECTION)
      .where("academicYearId", "==", academicYearId)
      .limit(500)
      .get();

    const queueSnapshotPromise = db
      .collection(QUEUE_COLLECTION)
      .limit(1000)
      .get();

    const [dueStudentsSnapshot, queueSnapshot] = await Promise.all([dueStudentsPromise, queueSnapshotPromise]);

    logFirestoreRead("FeeReminderDashboardAPI", STUDENTS_COLLECTION, dueStudentsSnapshot, { schoolId, academicYearId });
    logFirestoreRead("FeeReminderDashboardAPI", QUEUE_COLLECTION, queueSnapshot, { schoolId });

    const students = dueStudentsSnapshot.docs
      .map((doc) => serializeDoc(doc))
      .filter((s) => String(s.schoolId || "") === schoolId)
      .filter((s) => Number(s.totalFeesDue || 0) > 0)
      .filter((s) => String(s.feeStatus || "") !== "paid")
      .filter((s) => String(s.status || "") === "active");

    const totalDueStudents = students.length;
    const totalDueAmount = students.reduce((sum, s) => sum + (Number(s.totalFeesDue) || 0), 0);

    const classMap = new Map<string, { className: string; section: string; studentCount: number; totalDue: number }>();
    for (const s of students) {
      const key = `${String(s.className || s.class || "")}_${String(s.section || "")}`;
      if (!classMap.has(key)) {
        classMap.set(key, { className: String(s.className || s.class || ""), section: String(s.section || ""), studentCount: 0, totalDue: 0 });
      }
      const entry = classMap.get(key)!;
      entry.studentCount++;
      entry.totalDue += Number(s.totalFeesDue) || 0;
    }
    const classWiseDue = Array.from(classMap.values()).sort((a, b) => a.className.localeCompare(b.className));

    const feeTypeWiseDue = [
      { feeType: "Tuition Fee", totalDue: totalDueAmount, studentCount: totalDueStudents },
    ];

    const todayQueueItems = queueSnapshot.docs.filter((doc) => isToday(doc.data().createdAt));

    let remindersSentToday = 0;
    let remindersFailedToday = 0;
    const channelWiseReport = { whatsapp: { sent: 0, failed: 0 }, sms: { sent: 0, failed: 0 } };
    const deliveryStatusReport = { sent: 0, failed: 0, pending: 0, skipped: 0, duplicate: 0 };

    for (const doc of todayQueueItems) {
      const data = doc.data();
      const status = String(data.status || "pending");
      const channel = String(data.channel || "");

      if (status === "sent") {
        remindersSentToday++;
        deliveryStatusReport.sent++;
        if (channel === "whatsapp") channelWiseReport.whatsapp.sent++;
        else if (channel === "sms") channelWiseReport.sms.sent++;
      } else if (status === "failed") {
        remindersFailedToday++;
        deliveryStatusReport.failed++;
        if (channel === "whatsapp") channelWiseReport.whatsapp.failed++;
        else if (channel === "sms") channelWiseReport.sms.failed++;
      } else if (status === "pending") deliveryStatusReport.pending++;
      else if (status === "skipped") deliveryStatusReport.skipped++;
      else if (status === "duplicate") deliveryStatusReport.duplicate++;
    }

    const remindersPending = queueSnapshot.docs.filter((doc) => String(doc.data().status || "") === "pending").length;
    const remindersProcessing = queueSnapshot.docs.filter((doc) => String(doc.data().status || "") === "processing").length;

    return json({
      ok: true,
      totalDueStudents,
      totalDueAmount,
      remindersSentToday,
      remindersFailedToday,
      classWiseDue,
      feeTypeWiseDue,
      channelWiseReport,
      deliveryStatusReport,
      remindersPending,
      remindersProcessing,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load dashboard";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

