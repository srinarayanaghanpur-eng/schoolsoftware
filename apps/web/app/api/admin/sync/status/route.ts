import { adminDb } from "@/lib/firebaseAdmin";
import { json, requireAdmin, startTimer } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/sync/status
 * Returns the current sync status: whether the dashboard summary is dirty,
 * when it was last rebuilt, and when the last mutation happened.
 */
export async function GET(req: Request) {
  const timer = startTimer();
  try {
    const auth = await requireAdmin(req);
    if (!auth) return json({ ok: false, error: "Unauthorized", reason: "Missing or invalid role" }, { status: 403 });

    const db = adminDb();

    const [syncSnap, cacheStatusSnap] = await Promise.all([
      db.collection("sync").doc("dashboard_summary").get().catch(() => null),
      db.collection("system").doc("dashboardCacheStatus").get().catch(() => null)
    ]);

    const cacheStatus = cacheStatusSnap?.exists ? cacheStatusSnap.data() : null;

    if (!syncSnap || !syncSnap.exists) {
      return json({
        ok: true,
        status: "never_built",
        dirty: true,
        lastCleanAt: cacheStatus?.lastCleanedAt?.toDate?.()?.toISOString() ?? null,
        lastDirtyAt: null,
        lastDirtyContext: null,
        forcedSyncAt: null,
        cacheStatus: cacheStatus ? {
          lastCleanedBy: cacheStatus.lastCleanedBy ?? null,
          status: cacheStatus.status ?? null
        } : null
      });
    }

    const data = syncSnap.data()!;
    const dirtyAt = data.dirtyAt?.toDate?.() ?? null;
    const cleanAt = data.cleanAt?.toDate?.() ?? null;
    const forcedSyncAt = data.forcedSyncAt ?? null;

    const isDirty = !cleanAt || (dirtyAt && dirtyAt.getTime() > cleanAt.getTime());

    const totalMs = timer();

    return json({
      ok: true,
      status: isDirty ? "dirty" : "clean",
      dirty: isDirty,
      lastCleanAt: cleanAt?.toISOString() ?? cacheStatus?.lastCleanedAt?.toDate?.()?.toISOString() ?? null,
      lastDirtyAt: dirtyAt?.toISOString() ?? null,
      lastDirtyContext: data.lastDirtyContext ?? null,
      forcedSyncAt,
      cacheStatus: cacheStatus ? {
        lastCleanedBy: cacheStatus.lastCleanedBy ?? null,
        status: cacheStatus.status ?? null
      } : null,
      _metrics: { totalMs }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get sync status";
    return json({ ok: false, error: message }, { status: 500 });
  }
}

