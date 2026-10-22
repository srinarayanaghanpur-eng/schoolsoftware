import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdminOrPrincipal, json } from "@/lib/apiUtils";
import { firestoreQuotaResponse, isFirestoreQuotaPaused } from "@/lib/firebaseErrors";
import { logFirestoreAggregateRead } from "@/lib/firestoreReadLogger";

export const dynamic = "force-dynamic";

function istDateKey(date = new Date()) {
  return new Date(date.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * GET /api/admin/attendance/summary?date=YYYY-MM-DD
 * Dashboard tile counts via count() aggregations (~3 reads) instead of
 * scanning up to 100 attendance docs + 50 audit logs.
 */
export async function GET(req: Request) {
  const token = await requireAdminOrPrincipal(req);
  if (!token) return json({ ok: false, error: "Admin or principal access required" }, { status: 403 });

  if (isFirestoreQuotaPaused()) {
    return firestoreQuotaResponse();
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || istDateKey();
  const db = adminDb();

  const [presentSnap, lateSnap, activeTeachersSnap] = await Promise.all([
    db.collection("attendance").where("date", "==", date).where("status", "==", "present").count().get(),
    db.collection("attendance").where("date", "==", date).where("status", "==", "late").count().get(),
    db.collection("teachers").where("status", "==", "active").count().get()
  ]);

  logFirestoreAggregateRead("AttendanceSummaryAPI", "attendance", { operation: "today-present-count", date });
  logFirestoreAggregateRead("AttendanceSummaryAPI", "attendance", { operation: "today-late-count", date });
  logFirestoreAggregateRead("AttendanceSummaryAPI", "teachers", { operation: "active-count" });

  const present = Number(presentSnap.data().count || 0);
  const late = Number(lateSnap.data().count || 0);
  const total = Number(activeTeachersSnap.data().count || 0);
  const presentTotal = present + late;

  return json({
    ok: true,
    date,
    present: presentTotal,
    late,
    total,
    absent: Math.max(0, total - presentTotal)
  });
}
