import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";

const SETTINGS_COLLECTION = "fee_reminder_settings";
const QUEUE_COLLECTION = "fee_reminder_queue";

export async function POST(req: Request) {
  const token = await requirePermission(req, "fee_reminders.manage_settings");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = await req.json();
    const action = String(body.action || "").trim();
    const studentId = String(body.studentId || "").trim();
    const channel = String(body.channel || "whatsapp").trim();
    const academicYearId = String(body.academicYearId || "").trim();
    const schoolId = getSchoolId(token);
    const db = adminDb();
    const now = FieldValue.serverTimestamp();

    switch (action) {
      case "start_auto_reminder": {
        const perm = await requirePermission(req, "fee_reminders.manage_settings");
        if (!perm) return json({ ok: false, error: "Access denied" }, { status: 403 });
        const existing = await db.collection(SETTINGS_COLLECTION).where("schoolId", "==", schoolId).limit(1).get();
        if (existing.empty) {
          return json({ ok: false, error: "Settings not found. Create settings first." }, { status: 400 });
        }
        await existing.docs[0].ref.update({ enabled: true, updatedAt: now });
        return json({ ok: true, message: "Auto reminder started." });
      }

      case "stop_auto_reminder": {
        const perm = await requirePermission(req, "fee_reminders.manage_settings");
        if (!perm) return json({ ok: false, error: "Access denied" }, { status: 403 });
        const existing = await db.collection(SETTINGS_COLLECTION).where("schoolId", "==", schoolId).limit(1).get();
        if (existing.empty) {
          return json({ ok: false, error: "Settings not found." }, { status: 400 });
        }
        await existing.docs[0].ref.update({ enabled: false, updatedAt: now });
        return json({ ok: true, message: "Auto reminder stopped." });
      }

      case "test_reminder": {
        const perm = await requirePermission(req, "fee_reminders.send_test");
        if (!perm) return json({ ok: false, error: "Access denied" }, { status: 403 });
        if (!studentId) {
          return json({ ok: false, error: "studentId is required" }, { status: 400 });
        }
        const studentSnap = await db.collection("students").doc(studentId).get();
        if (!studentSnap.exists) {
          return json({ ok: false, error: "Student not found" }, { status: 404 });
        }
        const studentData = studentSnap.data() as Record<string, unknown>;
        const studentSchoolId = String(studentData.schoolId || "");
        if (studentSchoolId && studentSchoolId !== schoolId) {
          return json({ ok: false, error: "Student does not belong to this school" }, { status: 403 });
        }
        await db.collection(QUEUE_COLLECTION).add({
          schoolId,
          studentId,
          studentName: studentData.studentName || "",
          className: studentData.class || "",
          academicYearId: academicYearId || studentData.academicYearId || "",
          amount: Number(studentData.totalFeesDue) || 0,
          channel,
          status: "pending",
          isTest: true,
          createdBy: token.uid,
          createdAt: now,
          updatedAt: now,
        });
        return json({ ok: true, message: `Test reminder queued for ${studentId}.` });
      }

      case "dry_run": {
        const perm = await requirePermission(req, "fee_reminders.send_test");
        if (!perm) return json({ ok: false, error: "Access denied" }, { status: 403 });
        const studentsSnap = await db
          .collection("students")
          .where("schoolId", "==", schoolId)
          .where("academicYearId", "==", academicYearId)
          .where("totalFeesDue", ">", 0)
          .where("status", "==", "active")
          .limit(100)
          .get();
        logFirestoreRead("FeeReminderDryRun", "students", studentsSnap, { schoolId, academicYearId });
        const batch = db.batch();
        studentsSnap.docs.forEach((studentDoc) => {
          const s = studentDoc.data() as Record<string, unknown>;
          const ref = db.collection(QUEUE_COLLECTION).doc();
          batch.set(ref, {
            schoolId,
            studentId: studentDoc.id,
            studentName: s.studentName || "",
            className: s.class || "",
            academicYearId: academicYearId || s.academicYearId || "",
            amount: Number(s.totalFeesDue) || 0,
            channel,
            status: "skipped",
            skipReason: "dry_run",
            isTest: true,
            createdBy: token.uid,
            createdAt: now,
            updatedAt: now,
          });
        });
        await batch.commit();
        return json({ ok: true, message: `Dry run completed for ${studentsSnap.size} students.` });
      }

      case "retry_failed": {
        const perm = await requirePermission(req, "fee_reminders.retry_failed");
        if (!perm) return json({ ok: false, error: "Access denied" }, { status: 403 });
        const failedSnap = await db
          .collection(QUEUE_COLLECTION)
          .where("schoolId", "==", schoolId)
          .where("status", "==", "failed")
          .limit(500)
          .get();
        logFirestoreRead("FeeReminderRetryFailed", QUEUE_COLLECTION, failedSnap, { schoolId });
        if (failedSnap.empty) {
          return json({ ok: true, message: "No failed reminders to retry." });
        }
        const batch = db.batch();
        failedSnap.docs.forEach((doc) => {
          batch.update(doc.ref, { status: "pending", retryCount: FieldValue.increment(1), updatedAt: now });
        });
        await batch.commit();
        return json({ ok: true, message: `Retrying ${failedSnap.size} failed reminders.` });
      }

      case "retry_student": {
        const perm = await requirePermission(req, "fee_reminders.retry_failed");
        if (!perm) return json({ ok: false, error: "Access denied" }, { status: 403 });
        if (!studentId) {
          return json({ ok: false, error: "studentId is required" }, { status: 400 });
        }
        const failedSnap = await db
          .collection(QUEUE_COLLECTION)
          .where("schoolId", "==", schoolId)
          .where("studentId", "==", studentId)
          .where("status", "==", "failed")
          .limit(50)
          .get();
        logFirestoreRead("FeeReminderRetryStudent", QUEUE_COLLECTION, failedSnap, { schoolId, studentId });
        if (failedSnap.empty) {
          return json({ ok: true, message: `No failed reminders for student ${studentId}.` });
        }
        const batch = db.batch();
        failedSnap.docs.forEach((doc) => {
          batch.update(doc.ref, { status: "pending", retryCount: FieldValue.increment(1), updatedAt: now });
        });
        await batch.commit();
        return json({ ok: true, message: `Retrying ${failedSnap.size} failed reminders for student ${studentId}.` });
      }

      default:
        return json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process action";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

