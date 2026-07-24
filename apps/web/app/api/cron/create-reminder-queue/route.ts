import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, serializeDoc, errorMessage } from "@/lib/apiUtils";
import { logFirestoreRead, readLimit } from "@/lib/firestoreReadLogger";
import { isValidMobile, buildFeeReminderMessage } from "@/lib/reminder/messageBuilder";


export async function PUT(req: Request) {
  try {
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

        const dupSnap = await db.collection("fee_reminder_queue")
          .where("studentId", "==", studentDoc.id)
          .where("scheduledAt", "==", todayStr)
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          skipped++;
          continue;
        }

        const monthlyLimit = Number(settings.maxPerStudentPerMonth || 0);
        if (monthlyLimit > 0) {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          const countSnap = await db.collection("fee_reminder_queue")
            .where("studentId", "==", studentDoc.id)
            .where("createdAt", ">=", monthStart)
            .count()
            .get();
          const monthCount = Number(countSnap.data().count || 0);
          if (monthCount >= monthlyLimit) {
            skipped++;
            continue;
          }
        }

        const dueAmount = Number(student.totalFeesDue || 0);
        const minDue = Number(settings.minimumDueAmount || 0);
        if (minDue > 0 && dueAmount < minDue) {
          skipped++;
          continue;
        }

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

        await db.collection("fee_reminder_queue").add({
          studentId: studentDoc.id,
          parentName: String(student.parentName || ""),
          parentMobile,
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

        created++;
      }
    }

    const reason = skipped > 0 ? `${skipped} student(s) skipped due to eligibility filters` : "";
    return NextResponse.json({ ok: true, created, skipped, reason });
  } catch (error) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 400 });
  }
}
