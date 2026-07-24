import { AggregateField, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { json, requirePermission, startTimer } from "@/lib/apiUtils";
import { markSummaryClean } from "@/lib/markSummaryDirty";

export const dynamic = "force-dynamic";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function istDateKey(date: Date) {
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

function parseTimeToMinutes(time: string | undefined, fallbackMinutes: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time ?? "").trim());
  if (!match) return fallbackMinutes;
  return Number(match[1]) * 60 + Number(match[2]);
}

function istMinutesNow(): number {
  const ist = new Date(Date.now() + 330 * 60 * 1000);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

/**
 * POST /api/admin/sync/rebuild-dashboard-summary
 * Rebuilds the complete dashboard summary document in Firestore.
 * Call this after any data mutation or when the dashboard shows stale data.
 */
export async function POST(req: Request) {
  const totalTimer = startTimer();
  try {
    const auth = await requirePermission(req, "settings.edit");
    if (!auth) return json({ ok: false, error: "Unauthorized", reason: "Missing or invalid role" }, { status: 403 });

    const db = adminDb();
    const now = new Date();
    const today = istDateKey(now);
    const weekAgo = istDateKey(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const yearSnap = await db.collection("academic_years").where("isActive", "==", true).limit(1).get().catch(() => null);
    const yearId = yearSnap?.docs[0]?.id ?? "";

    const scoped = <T extends FirebaseFirestore.Query>(query: T): T =>
      (yearId ? (query.where("academicYearId", "==", yearId) as T) : query);

    const [
      studentsCountSnap,
      activeTeachersCountSnap,
      feeTotalsSnap,
      studentsPendingSnap,
      feesCollectedSnap,
      feesCollectedTodaySnap,
      weekAttSnap,
      noticesSnap,
      recentStudentsSnap
    ] = await Promise.all([
      db.collection("students").count().get(),
      db.collection("teachers").where("status", "==", "active").count().get(),
      scoped(db.collection("studentFeeSummaries")).aggregate({
        totalFeeAmount: AggregateField.sum("totalFee"),
        feesOutstanding: AggregateField.sum("dueAmount"),
        totalPaid: AggregateField.sum("totalPaid")
      }).get().catch(() => null),
      scoped(db.collection("studentFeeSummaries")).where("dueAmount", ">", 0).count().get().catch(() => null),
      scoped(db.collection("financeSummaries")).aggregate({
        feesCollected: AggregateField.sum("totalIncome")
      }).get().catch(() => null),
      db.collection("payments")
        .where("status", "==", "completed")
        .where("createdAt", ">=", startOfToday)
        .where("createdAt", "<=", endOfToday)
        .aggregate({ feesCollectedToday: AggregateField.sum("amountPaid") }).get().catch(() => null),
      db.collection("attendance").where("date", ">=", weekAgo).where("date", "<=", today).limit(2000).get(),
      db.collection("notifications").orderBy("createdAt", "desc").limit(3).get().catch(() => null),
      db.collection("students").orderBy("createdAt", "desc").limit(3).get().catch(() => null)
    ]);

    const totalStudents = Number(studentsCountSnap.data().count || 0);
    const totalTeachers = Number(activeTeachersCountSnap.data().count || 0);
    const feeTotals = (feeTotalsSnap?.data() ?? {}) as Record<string, unknown>;
    const totalFeeAmount = Number(feeTotals.totalFeeAmount || 0);
    const feesOutstanding = Number(feeTotals.feesOutstanding || 0);
    const studentsPending = Number(studentsPendingSnap?.data().count || 0);
    const feesCollected = Number(feesCollectedSnap?.data().feesCollected || feeTotals.totalPaid || 0);
    const feesCollectedToday = Number(feesCollectedTodaySnap?.data().feesCollectedToday || 0);

    const present = (status?: string) => status === "present" || status === "late" || status === "checked_in" || status === "half_day" || status === "short_hours";
    const byDay = new Map<string, { present: number }>();
    let presentToday = 0;

    weekAttSnap.docs.forEach((doc) => {
      const attendance = doc.data();
      if (attendance.date === today && present(attendance.status)) presentToday += 1;
      const entry = byDay.get(attendance.date) ?? { present: 0 };
      if (present(attendance.status)) entry.present += 1;
      byDay.set(attendance.date, entry);
    });

    const weekAttendance = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
      const key = istDateKey(date);
      const presentCount = byDay.get(key)?.present ?? 0;
      return {
        day: DAY_LABELS[date.getDay()],
        value: totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 0
      };
    });

    const recentStudents = (recentStudentsSnap?.docs ?? [])
      .map((doc) => doc.data())
      .map((student) => {
        const name = student.studentName || "Unknown";
        return {
          name: `${name}${student.class ? ` · Class ${student.class}${student.section || ""}` : ""}`,
          className: student.class || "",
          initials: name.split(" ").map((part: string) => part[0]).join("").slice(0, 2).toUpperCase() || "?"
        };
      });

    const notices = (noticesSnap?.docs ?? []).map((doc) => {
      const notice = doc.data();
      return {
        title: notice.title || notice.message || "Notice",
        meta: notice.createdAt ? new Date(notice.createdAt).toLocaleDateString("en-IN") : "Recently"
      };
    });

    let attendanceCutoffPassed = false;
    try {
      const settingsSnap = await db.collection("settings").doc("school").get();
      const settings = settingsSnap.data() ?? {};
      const startMinutes = parseTimeToMinutes(settings.schoolStartTime as string, 9 * 60);
      const graceMinutes = Number(settings.graceMinutes ?? 10) || 0;
      attendanceCutoffPassed = istMinutesNow() > startMinutes + graceMinutes;
    } catch {
      // settings unavailable
    }

    const summary = {
      totalStudents,
      totalTeachers,
      presentToday,
      feesCollected,
      feesCollectedToday,
      feesOutstanding,
      totalFeeAmount,
      studentsPending,
      weekAttendance,
      recentStudents,
      notices,
      attendanceCutoffPassed,
      yearId,
      rebuiltAt: new Date().toISOString(),
      schoolId: auth.uid // track who triggered rebuild
    };

    // Write summary to Firestore
    await db.collection("dashboardSummaries").doc("current").set(summary, { merge: true });

    // Mark the sync doc as clean
    await markSummaryClean(auth.uid);

    // Store last cleaned time in system/dashboardCacheStatus
    try {
      await db.collection("system").doc("dashboardCacheStatus").set({
        lastCleanedAt: FieldValue.serverTimestamp(),
        lastCleanedBy: auth.uid,
        status: "ok",
        error: null
      }, { merge: true });
    } catch {
      // non-critical
    }

    const totalMs = totalTimer();

    return json({
      ok: true,
      summary,
      _metrics: { totalMs }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to rebuild dashboard summary";
    console.error("[rebuild-dashboard-summary] error:", error);
    return json({ ok: false, error: message }, { status: 500 });
  }
}

