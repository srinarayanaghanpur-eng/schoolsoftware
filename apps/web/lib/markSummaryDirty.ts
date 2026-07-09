import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "./firebaseAdmin";

let _db: FirebaseFirestore.Firestore | null = null;

function db() {
  if (!_db) _db = adminDb();
  return _db;
}

const SYNC_DOC_ID = "dashboard_summary";

/**
 * Mark the dashboard summary document as dirty so the dashboard knows it
 * needs to rebuild. Called automatically after student / payment / fee /
 * salary / attendance mutations.
 *
 * The document lives at `sync/dashboard_summary` and has a `dirtyAt`
 * timestamp and a `lastCleanAt` timestamp. The dashboard checks `dirtyAt >
 * lastCleanAt` to decide whether to rebuild.
 */
export async function markSummaryDirty(context?: string) {
  try {
    await db().collection("sync").doc(SYNC_DOC_ID).set(
      {
        dirtyAt: FieldValue.serverTimestamp(),
        lastDirtyContext: context ?? "unknown",
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("[markSummaryDirty] failed:", error);
  }
}

/**
 * Mark the dashboard summary as clean after a successful rebuild.
 * Optionally records who triggered the rebuild in the system status doc.
 */
export async function markSummaryClean(cleanedBy?: string) {
  try {
    await db().collection("sync").doc(SYNC_DOC_ID).set(
      {
        cleanAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("[markSummaryClean] failed:", error);
  }
}

/**
 * Returns true if the dashboard summary is dirty (needs rebuild).
 */
export async function isSummaryDirty(): Promise<boolean> {
  try {
    const snap = await db().collection("sync").doc(SYNC_DOC_ID).get();
    if (!snap.exists) return true;
    const data = snap.data()!;
    const dirtyAt = data.dirtyAt?.toDate?.() ?? new Date(0);
    const cleanAt = data.cleanAt?.toDate?.() ?? new Date(0);
    return dirtyAt.getTime() > cleanAt.getTime();
  } catch {
    return true;
  }
}
