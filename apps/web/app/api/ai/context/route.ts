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
    const academicYearId = req.headers.get("x-academic-year") || "current";

    const [
      studentsSnap,
      teachersSnap,
      feeSummary,
      noticesSnap,
    ] = await Promise.all([
      db.collection("students").where("schoolId", "==", schoolId).limit(1).select("studentName").get().catch(() => null),
      db.collection("teachers").where("schoolId", "==", schoolId).limit(1).select("name").get().catch(() => null),
      getFeeDueSummary(schoolId, academicYearId),
      db.collection("notices").where("schoolId", "==", schoolId).orderBy("createdAt", "desc").limit(3).get().catch(() => null),
    ]);

    const context: Record<string, unknown> = {
      schoolName: "Sri Narayana High School",
      academicYearId,
      totalStudentsEstimate: studentsSnap?.size || "unknown",
      totalTeachersEstimate: teachersSnap?.size || "unknown",
      recentNotices: noticesSnap?.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          title: String(data.title || data.topic || "").slice(0, 100),
          date: String(data.createdAt || ""),
          target: String(data.target || ""),
        };
      }) || [],
      feeDueSummary: feeSummary || null,
    };

    return NextResponse.json({ ok: true, data: context });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load context";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
