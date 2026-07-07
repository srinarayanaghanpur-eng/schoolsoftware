import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getSchoolId } from "@/lib/schoolScope";
import { getFeeDueSummary } from "@/lib/quota/firebaseQuotaGuard";

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.CHAT);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const schoolId = getSchoolId(token);
    const db = adminDb();
    const academicYearId = "current";
    const today = new Date().toISOString().slice(0, 10);

    const baseQuery = (col: string) => db.collection(col).where("schoolId", "==", schoolId);

    const [
      studentsSnap,
      feeDueSummary,
      noticesSnap,
      classesSnap,
      teachersSnap,
      pendingApprovalsSnap,
      todayAttendanceSnap,
    ] = await Promise.all([
      baseQuery("students").select("class").get().catch(() => null),
      getFeeDueSummary(schoolId, academicYearId),
      baseQuery("notices").orderBy("createdAt", "desc").limit(5).get().catch(() => null),
      baseQuery("classes").get().catch(() => null),
      baseQuery("teachers").get().catch(() => null),
      baseQuery("approval_requests").where("status", "==", "pending").get().catch(() => null),
      db.collection("attendance").where("schoolId", "==", schoolId).where("date", "==", today).get().catch(() => null),
    ]);

    const totalStudents = studentsSnap?.docs.length || 0;

    const studentsByClass: Record<string, number> = {};
    studentsSnap?.docs.forEach((d) => {
      const cls = String(d.data().class || "Unknown");
      studentsByClass[cls] = (studentsByClass[cls] || 0) + 1;
    });

    const totalPresent = todayAttendanceSnap?.docs.filter((d) => d.data().status === "present").length || 0;
    const totalAbsent = todayAttendanceSnap?.docs.filter((d) => d.data().status === "absent").length || 0;

    const context = {
      schoolName: "Sri Narayana High School",
      academicYearId,
      students: {
        total: totalStudents,
        byClass: studentsByClass,
        totalClasses: classesSnap?.docs.length || 0,
      },
      teachers: {
        total: teachersSnap?.docs.length || 0,
      },
      attendance: {
        date: today,
        present: totalPresent,
        absent: totalAbsent,
        totalMarked: totalPresent + totalAbsent,
      },
      fee: {
        summary: feeDueSummary || null,
      },
      notices: {
        recent: noticesSnap?.docs.map((d) => ({
          title: String(d.data().title || d.data().topic || "").slice(0, 120),
          date: d.data().createdAt ? String(d.data().createdAt).slice(0, 10) : "",
          target: String(d.data().target || "all"),
        })) || [],
      },
      pendingApprovals: pendingApprovalsSnap?.docs.length || 0,
    };

    return NextResponse.json({ ok: true, data: context });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load context";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
