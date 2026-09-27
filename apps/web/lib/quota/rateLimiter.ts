import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

/**
 * Firestore-backed fixed-window rate limiter.
 *
 * The previous implementation kept counters in a module-level Map, which is
 * useless on Vercel serverless: every lambda instance (and cold start) has its
 * own empty Map, so limits effectively never trigger. Counters now live in the
 * `rate_limits` collection and are advanced with a transaction, so all
 * instances share one view.
 *
 * Each check costs 1 read + 1 write — wire it into low-QPS, high-risk
 * endpoints (auth-ish, device ingest, public submit), not into hot listing
 * routes.
 *
 * Firestore errors fail OPEN (allowed: true) with a warning: a datastore
 * hiccup must not lock staff/devices out of the school system. Set a TTL
 * policy on `rate_limits.expiresAt` in the Firebase console so old windows
 * are auto-deleted.
 */

function sanitize(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 400);
}

/** Absolute start of the fixed window (ms epoch) for a window length. */
function windowStart(windowMs: number): number {
  return Math.floor(Date.now() / windowMs) * windowMs;
}

async function hit(params: {
  key: string;
  windowMs: number;
  maxRequests: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const start = windowStart(params.windowMs);
  const resetAt = new Date(start + params.windowMs);
  const id = `${sanitize(params.key)}__${start}`;

  try {
    const db = adminDb();
    const ref = db.collection("rate_limits").doc(id);

    let allowed = true;
    let count = 0;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      const current = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
      if (current >= params.maxRequests) {
        allowed = false;
        count = current;
        return;
      }
      count = current + 1;
      transaction.set(
        ref,
        {
          count: count,
          resetAt,
          expiresAt: resetAt,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      if (!snap.exists) {
        // First hit in this window: also stamp creation metadata.
        transaction.set(ref, { createdAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    });

    return { allowed, remaining: Math.max(0, params.maxRequests - count), resetAt };
  } catch (error) {
    console.error("[rateLimiter] Firestore check failed — failing open:", error);
    return { allowed: true, remaining: params.maxRequests, resetAt };
  }
}

export async function checkRateLimit(params: {
  key: string;
  maxRequests: number;
  windowMinutes: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const windowMs = Math.max(1, params.windowMinutes) * 60 * 1000;
  return hit({ key: params.key, windowMs, maxRequests: params.maxRequests });
}

export async function checkDailyRateLimit(params: {
  key: string;
  maxRequests: number;
}): Promise<{ allowed: boolean; remaining: number }> {
  // Daily windows are aligned to UTC midnight regardless of windowMinutes.
  const result = await hit({
    key: params.key,
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: params.maxRequests
  });
  return { allowed: result.allowed, remaining: result.remaining };
}

/** Deletes active (not-yet-expired) windows so an admin "reset limits" action
 * works across instances. Bounded to 500 docs per call. */
export async function resetRateLimiter(): Promise<void> {
  try {
    const db = adminDb();
    const snap = await db
      .collection("rate_limits")
      .where("expiresAt", ">=", new Date(Date.now() - 60_000))
      .limit(500)
      .get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("[rateLimiter] reset failed:", error);
  }
}
