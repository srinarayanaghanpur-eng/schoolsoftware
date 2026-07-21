import { NextResponse } from "next/server";
import type { AttendanceRecord, AppUser, Teacher } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAuthenticated, serializeDoc, startTimer } from "@/lib/apiUtils";

/**
 * Self-service staff profile + recent attendance for ANY signed-in staff
 * member (accountant, principal, receptionist, teacher, …). Unlike
 * /api/teacher/me this is not restricted to the teacher role — it resolves the
 * caller's linked staff record (in the `teachers` collection) by their uid.
 */
export async function GET(req: Request) {
  const totalTimer = startTimer();
  try {
    const decodedToken = await requireAuthenticated(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Authentication required" }, { status: 401 });
    }

    const db = adminDb();
    const userSnapshot = await db.collection("users").doc(decodedToken.uid).get();
    const userData = userSnapshot.exists ? (userSnapshot.data() as AppUser) : undefined;
    let teacherId = typeof decodedToken.teacherId === "string" ? decodedToken.teacherId : userData?.teacherId;

    // Fall back to matching a staff record by uid when no explicit link exists.
    if (!teacherId) {
      const byUid = await db.collection("teachers").where("uid", "==", decodedToken.uid).limit(1).get();
      if (!byUid.empty) teacherId = byUid.docs[0].id;
    }

    if (!teacherId) {
      return NextResponse.json(
        { ok: false, error: "No staff record is linked to your account. Please contact the administrator." },
        { status: 404 }
      );
    }

    const dbTimer = startTimer();
    const [teacherSnapshot, attendanceSnapshot] = await Promise.all([
      db.collection("teachers").doc(teacherId).get(),
      db.collection("attendance").where("teacherId", "==", teacherId).limit(120).get()
    ]);
    const dbMs = dbTimer();

    if (!teacherSnapshot.exists) {
      return NextResponse.json({ ok: false, error: "Your staff profile was not found." }, { status: 404 });
    }

    const teacher = { id: teacherSnapshot.id, ...teacherSnapshot.data() } as Teacher;
    if (teacher.status !== "active") {
      return NextResponse.json({ ok: false, error: "Your staff record is inactive. Please contact the administrator." }, { status: 403 });
    }

    const records = attendanceSnapshot.docs
      .map((doc) => serializeDoc<AttendanceRecord>(doc))
      .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
      .slice(0, 60);

    const totalMs = totalTimer();
    if (process.env.NODE_ENV === "development") console.log(`[API] /api/staff/me - DB: ${dbMs}ms, Total: ${totalMs}ms, Records: ${records.length}`);

    return NextResponse.json({ ok: true, teacher, records, _metrics: { dbMs, totalMs } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load your attendance";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
