import { adminDb } from "@/lib/firebaseAdmin";
import { json, requireSuperAdmin, startTimer } from "@/lib/apiUtils";
import { clearAdminApiCacheForSignOut } from "@/lib/adminApiClient";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/sync/force
 * Returns a nonce token that tells the client to clear all caches.
 * The client checks for this on every page load and clears memory + localStorage + IndexedDB caches.
 *
 * Also resets the server-side dashboard cache module variable on every call.
 */
const FRESH_TTL_MS = 60_000;
let forceSyncNonce = Date.now().toString();
let forceSyncNonceAt = Date.now();

function getNonce() {
  if (Date.now() - forceSyncNonceAt > FRESH_TTL_MS) {
    forceSyncNonce = Date.now().toString();
    forceSyncNonceAt = Date.now();
  }
  return forceSyncNonce;
}

/**
 * Force a fresh nonce (called externally from the force-sync API).
 */
function bumpNonce() {
  forceSyncNonce = Date.now().toString();
  forceSyncNonceAt = Date.now();
}

export async function POST(req: Request) {
  const totalTimer = startTimer();
  try {
    const auth = await requireSuperAdmin(req);
    if (!auth) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

    bumpNonce();

    const db = adminDb();

    // Reset the sync dirty/clean timestamps so dashboard knows data is fresh
    await db.collection("sync").doc("dashboard_summary").set(
      {
        cleanAt: new Date(),
        dirtyAt: null,
        forcedSyncAt: new Date().toISOString(),
        forcedBy: auth.uid
      },
      { merge: true }
    ).catch(() => {});

    const totalMs = totalTimer();

    return json({
      ok: true,
      nonce: getNonce(),
      message: "Sync forced. Clear client caches and rebuild dashboard summary.",
      _metrics: { totalMs }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to force sync";
    console.error("[sync/force] error:", error);
    return json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return json({ ok: true, nonce: getNonce() });
}
