import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, errorMessage } from "@/lib/apiUtils";
import { isValidMobile, buildFeeReminderMessage } from "@/lib/reminder/messageBuilder";

/**
 * Auth: this endpoint scans all fee-due students and queues reminder messages,
 * so it must never be publicly callable. Allowed callers:
 *  1. An external scheduler presenting `x-cron-secret` matching CRON_SECRET.
 *  2. A signed-in admin (manual "run now" from the fee-reminders UI).
 * Without a configured CRON_SECRET only signed-in admins may call it.
 */
async function isAuthorizedCronCall(req: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") === secret) return true;
  return Boolean(await requireAdmin(req));
}

export async function PUT(req: Request) {
  try {
    if (!(await isAuthorizedCronCall(req))) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const db = adminDb();
    const settingsSnap = await db.collection("fee_reminder_settings")
      .where("enabled", "==", true)
      .get();

    if (settingsSnap.empty) {
      return NextResponse.json({ ok: true, created: 0, skipped: 0, reason: "No enabled settings found" });
    }

    let created = 0;
    let skipped = 0;
    const todayStr = new Date().toISOString().split("T")[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    for (const settingsDoc of settingsSnap.docs) {
      const settings = settingsDoc.data() as Record<string, unknown>;
      const academicYearId = String(settings.academicYearId || "");
      const schoolId = String(settings.schoolId || process.env.SCHOOL_ID || "default-school");

      if (settings.skipHolidays) {
        const holidaySnap = await db.collection("holidays")
          .where("date", "==", todayStr)
          .limit(1)
          .get();
        if (!holidaySnap.empty) continue;
      }

      let studentQuery: FirebaseFirestore.Query = db.collection("students")
        .where("totalFeesDue", ">", 0);
      if (academicYearId) studentQuery = studentQuery.where("academicYearId", "==", academicYearId);

      const studentSnap = await studentQuery.limit(500).get();

      // Pass 1: pure in-memory eligibility (no I/O).
      type Candidate = { id: string; student: Record<string, unknown>; parentMobile: string; dueAmount: number };
      const candidates: Candidate[] = [];
      for (const studentDoc of studentSnap.docs) {
        const student = studentDoc.data() as Record<string, unknown>;

        if (String(student.feeStatus || "") === "paid") {
          skipped++;
          continue;
        }

        if (student.reminderOptIn === false) {
          skipped++;
          continue;
        }

        const parentMobile = String(student.parentMobile || "");
        if (!isValidMobile(parentMobile)) {
          skipped++;
          continue;
        }

        const dueAmount = Number(student.totalFeesDue || 0);
        const minDue = Number(settings.minimumDueAmount || 0);
        if (minDue > 0 && dueAmount < minDue) {
          skipped++;
          continue;
        }

        candidates.push({ id: studentDoc.id, student, parentMobile, dueAmount });
      }

      // Pass 2: duplicate + monthly-limit checks in parallel chunks
      // (same query shapes as before — no new indexes required).
      const monthlyLimit = Number(settings.maxPerStudentPerMonth || 0);
      const eligible: Candidate[] = [];
      const checkChunkSize = 25;
      for (let i = 0; i < candidates.length; i += checkChunkSize) {
        const chunk = candidates.slice(i, i + checkChunkSize);
        const results = await Promise.all(
          chunk.map(async (candidate) => {
            const dupSnap = await db.collection("fee_reminder_queue")
              .where("studentId", "==", candidate.id)
              .where("scheduledAt", "==", todayStr)
              .limit(1)
              .get();
            if (!dupSnap.empty) return false;
            if (monthlyLimit > 0) {
              const countSnap = await db.collection("fee_reminder_queue")
                .where("studentId", "==", candidate.id)
                .where("createdAt", ">=", monthStart)
                .count()
                .get();
              if (Number(countSnap.data().count || 0) >= monthlyLimit) return false;
            }
            return true;
          })
        );
        results.forEach((ok, index) => {
          if (ok) eligible.push(chunk[index]);
          else skipped++;
        });
      }

      // Pass 3: build messages, then commit in batches instead of one
      // sequential add() per student.
      for (let i = 0; i < eligible.length; i += 400) {
        const chunk = eligible.slice(i, i + 400);
        const batch = db.batch();
        for (const candidate of chunk) {
          const student = candidate.student;
          const dueAmount = candidate.dueAmount;
          const message = buildFeeReminderMessage({
            parentName: String(student.parentName || ""),
            studentName: String(student.studentName || ""),
            className: String(student.className || student.class || ""),
            section: String(student.section || ""),
            dueAmount,
            feeType: "Tuition Fee",
            totalDue: dueAmount,
            schoolName: String(settings.schoolName || ""),
            supportPhone: String(settings.supportPhone || "")
          });

          batch.set(db.collection("fee_reminder_queue").doc(), {
            studentId: candidate.id,
            parentName: String(student.parentName || ""),
            parentMobile: candidate.parentMobile,
            alternateMobile: "",
            className: String(student.className || student.class || ""),
            section: String(student.section || ""),
            studentName: String(student.studentName || ""),
            admissionNumber: String(student.admissionNumber || ""),
            feeType: "Tuition Fee",
            dueAmount,
            feeBreakup: [],
            totalDue: dueAmount,
            message,
            channel: "",
            status: "pending",
            reason: "",
            attempts: 0,
            providerMessageId: "",
            scheduledAt: todayStr,
            sentAt: "",
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            academicYearId: academicYearId || "",
            schoolId
          });
        }
        await batch.commit();
        created += chunk.length;
      }
    }

    const reason = skipped > 0 ? `${skipped} student(s) skipped due to eligibility filters` : "";
    return NextResponse.json({ ok: true, created, skipped, reason });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
