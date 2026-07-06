import { NextResponse } from "next/server";
import { filterActiveHolidays, findHolidayForDate, toDateKey, type AttendanceRecord, type AppUser, type Holiday, type Teacher } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireSignedIn, serializeDoc, startTimer } from "@/lib/apiUtils";
import { getSchoolSettings } from "@/lib/firestoreServer";

export async function GET(req: Request) {
  const totalTimer = startTimer();
  try {
    const decodedToken = await requireSignedIn(req);
    if (!decodedToken || decodedToken.role !== "teacher") {
      return NextResponse.json({ ok: false, error: "Teacher access required" }, { status: 403 });
    }

    const db = adminDb();
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const userData = userSnapshot.exists ? (userSnapshot.data() as AppUser) : undefined;
    const teacherId = typeof decodedToken.teacherId === "string" ? decodedToken.teacherId : userData?.teacherId;

    if (!teacherId) {
      return NextResponse.json({ ok: false, error: "Teacher profile is missing." }, { status: 404 });
    }

    const settings = await getSchoolSettings();
    const today = toDateKey(new Date(), settings.timezone);
    const month = today.slice(0, 7);

    const dbTimer = startTimer();
    const [teacherSnapshot, attendanceSnapshot, holidaysSnapshot] = await Promise.all([
      db.collection("teachers").doc(teacherId).get(),
      db.collection("attendance").where("teacherId", "==", teacherId).limit(120).get(),
      db.collection("holidays").where("date", ">=", `${month}-01`).where("date", "<=", `${month}-31`).get()
    ]);
    const dbMs = dbTimer();

    if (!teacherSnapshot.exists) {
      return NextResponse.json({ ok: false, error: "Teacher profile was not found." }, { status: 404 });
    }

    const teacher = { id: teacherSnapshot.id, ...teacherSnapshot.data() } as Teacher;
    if (teacher.status !== "active") {
      return NextResponse.json({ ok: false, error: "Your teacher login is inactive. Please contact admin." }, { status: 403 });
    }

    const records = attendanceSnapshot.docs
      .map((doc) => serializeDoc<AttendanceRecord>(doc))
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
      .slice(0, 60);
    const holidays = filterActiveHolidays(holidaysSnapshot.docs.map((doc) => serializeDoc<Holiday>(doc)));
    const todayHoliday = findHolidayForDate(holidays, today) ?? null;

    const totalMs = totalTimer();
    console.log(`[API] /api/teacher/me - DB: ${dbMs}ms, Total: ${totalMs}ms, Records: ${records.length}`);

    return NextResponse.json({ ok: true, teacher, records, holidays, todayHoliday, _metrics: { dbMs, totalMs } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load teacher dashboard";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
