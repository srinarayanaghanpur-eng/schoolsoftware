/**
 * In-flight GET deduplication (premium pass).
 *
 * Every parent screen calls useParentSummary on mount — six identical
 * /api/portal/summary requests on a cold start. This collapses concurrent
 * identical requests into one shared promise. Dependency-free so it runs
 * under plain node:test.
 *
 * Only for idempotent reads: never wrap POST/PUT/DELETE.
 */

const inflight = new Map<string, Promise<unknown>>();

export function deduped<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const pending = fn().then(
    (value) => {
      if (inflight.get(key) === pending) inflight.delete(key);
      return value;
    },
    (error: unknown) => {
      if (inflight.get(key) === pending) inflight.delete(key);
      throw error;
    }
  );
  inflight.set(key, pending);
  return pending;
}

/** Test seam: how many requests are currently shared in flight. */
export function inflightCount(): number {
  return inflight.size;
}
