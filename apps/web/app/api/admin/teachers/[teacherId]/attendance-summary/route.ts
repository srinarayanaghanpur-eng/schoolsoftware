import { createAttendanceDocumentId } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdminOrPrincipal, json } from "@/lib/apiUtils";

function istToday() {
  const now = new Date();
  return new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * GET /api/admin/teachers/[teacherId]/attendance-summary
 *
 * Per-teacher month summary for the staff detail screen. Attendance documents
 * use deterministic ids (`teacherId_YYYY-MM-DD`), so one getAll() covers the
 * whole month — at most 31 reads, no composite index needed.
 */
export async function GET(req: Request, { params }: { params: { teacherId: string } }) {
  const token = await requireAdminOrPrincipal(req);
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const todayIst = istToday();
    const currentMonth = `${todayIst.getUTCFullYear()}-${pad(todayIst.getUTCMonth() + 1)}`;
    const requested = searchParams.get("month") || currentMonth;
    const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonth;

    const db = adminDb();
    const teacherSnap = await db.collection("teachers").doc(params.teacherId).get();
    if (!teacherSnap.exists) return json({ ok: false, error: "Teacher not found" }, { status: 404 });
    const joiningDate = String(teacherSnap.data()?.joiningDate ?? "").slice(0, 10);

    const [yearStr, monthStr] = month.split("-");
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const isCurrentMonth = month === currentMonth;
    const lastDay = isCurrentMonth ? Math.min(todayIst.getUTCDate(), daysInMonth) : daysInMonth;

    const dates: string[] = [];
    for (let day = 1; day <= lastDay; day += 1) {
      const dateStr = `${month}-${pad(day)}`;
      if (joiningDate && dateStr < joiningDate) continue;
      // Sundays are non-working days for the school.
      if (new Date(Date.UTC(year, monthIndex, day)).getUTCDay() === 0) continue;
      dates.push(dateStr);
    }

    const refs = dates.map((date) => db.collection("attendance").doc(createAttendanceDocumentId(params.teacherId, date)));
    const snaps = refs.length > 0 ? await db.getAll(...refs) : [];

    let present = 0;
    let late = 0;
    const records: {
      date: string;
      status: string;
      checkInTime?: string;
      checkOutTime?: string;
    }[] = [];

    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() ?? {};
      const status = String(data.status ?? "absent");
      const date = String(data.date ?? snap.id.split("_").slice(1).join("_") ?? "");
      if (status === "late") late += 1;
      else if (status !== "absent") present += 1;
      records.push({
        date,
        status,
        checkInTime: typeof data.checkInTime === "string" ? data.checkInTime : undefined,
        checkOutTime: typeof data.checkOutTime === "string" ? data.checkOutTime : undefined
      });
    }

    records.sort((a, b) => b.date.localeCompare(a.date));

    return json({
      ok: true,
      month,
      workingDays: dates.length,
      present,
      late,
      absent: Math.max(0, dates.length - present - late),
      records
    });
  } catch (error) {
    console.error("[TeacherAttendanceSummary] GET failed:", error);
    return json({ ok: false, error: "Unable to load attendance summary" }, { status: 500 });
  }
}
