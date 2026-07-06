"use client";

import { auth } from "@sri-narayana/shared/firebase/client";

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Client-side request layer with:
//  - in-flight dedupe (two components asking for the same GET share one call)
//  - short-TTL memory cache (SWR-style; avoids refetch on every navigation)
//  - localStorage stale fallback (quota/network failure shows last good data
//    instead of a blank screen) — GET only, never for mutations
//  - automatic cache invalidation after any mutation (POST/PUT/PATCH/DELETE)
//
// Safety rules:
//  - Cache keys are scoped to the signed-in user's uid → no cross-account
//    data leaks on shared devices.
//  - Stale fallback is used ONLY for network failure (status 0), 429 quota,
//    and 5xx. 401/403 always propagate so auth problems are never masked by
//    old private data.
//  - Signing out (uid change) makes previous keys unreachable, and
//    clearAdminApiCacheForSignOut() wipes persisted copies.
// ---------------------------------------------------------------------------

const FRESH_TTL_MS = 30_000; // serve from memory without hitting the network
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // localStorage fallback lifetime
const LS_PREFIX = "snapi:"; // localStorage key prefix
const MAX_LS_ENTRY_BYTES = 200_000; // don't persist huge payloads

type CacheEntry = { data: unknown; at: number };

const memoryCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function now() {
  return Date.now();
}

/** Cache key scoped to the current user so accounts never see each other's data. */
function cacheKey(path: string): string {
  const uid = auth.currentUser?.uid ?? "anon";
  return `${uid}|${path}`;
}

function readStale(key: string): unknown | null {
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || now() - parsed.at > STALE_TTL_MS) {
      window.localStorage.removeItem(LS_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStale(key: string, data: unknown) {
  try {
    const raw = JSON.stringify({ data, at: now() } satisfies CacheEntry);
    if (raw.length <= MAX_LS_ENTRY_BYTES) {
      window.localStorage.setItem(LS_PREFIX + key, raw);
    }
  } catch {
    // storage full/blocked — fallback simply unavailable
  }
}

/**
 * Drop cached GET responses (memory + localStorage) for the current user.
 * Called automatically after every mutation. `pathPrefix` narrows the wipe.
 */
export function invalidateAdminApiCache(pathPrefix?: string) {
  const uid = auth.currentUser?.uid ?? "anon";
  const keyPrefix = pathPrefix ? `${uid}|${pathPrefix}` : `${uid}|`;
  for (const key of Array.from(memoryCache.keys())) {
    if (key.startsWith(keyPrefix)) memoryCache.delete(key);
  }
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX + keyPrefix)) window.localStorage.removeItem(k);
    }
  } catch {
    // ignore storage errors
  }
}

/** Wipe ALL cached API data for every user. Call on sign-out. */
export function clearAdminApiCacheForSignOut() {
  memoryCache.clear();
  inflight.clear();
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) window.localStorage.removeItem(k);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * True when the failure is retryable and stale data is an acceptable
 * substitute. Auth errors (401/403) and client errors (4xx) always propagate.
 */
function isFallbackWorthy(status: number) {
  return status === 0 || status === 429 || status >= 500;
}

async function rawRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new AdminApiError("Please sign in again.", 401);
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        ...(init?.headers ?? {})
      }
    });
  } catch {
    // network down / offline
    throw new AdminApiError("You appear to be offline.", 0);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new AdminApiError(result.error ?? "Request failed", response.status);
  }

  return result as T;
}

export interface AdminApiOptions {
  /** Bypass the fresh-TTL memory cache (still dedupes concurrent calls). */
  fresh?: boolean;
  /** Override the fresh TTL for this path, in ms. */
  ttlMs?: number;
}

export async function adminApiRequest<T>(path: string, init?: RequestInit, opts?: AdminApiOptions): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();

  // Mutations: never cached, never served stale. On success, invalidate
  // cached GETs so lists reflect the change immediately.
  if (method !== "GET") {
    const result = await rawRequest<T>(path, init);
    invalidateAdminApiCache();
    return result;
  }

  const key = cacheKey(path);
  const ttl = opts?.ttlMs ?? FRESH_TTL_MS;

  // 1. Fresh memory cache — no network, no Firestore reads.
  if (!opts?.fresh) {
    const hit = memoryCache.get(key);
    if (hit && now() - hit.at < ttl) return hit.data as T;
  }

  // 2. In-flight dedupe — concurrent identical GETs share one request.
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    try {
      const result = await rawRequest<T>(path, init);
      memoryCache.set(key, { data: result, at: now() });
      writeStale(key, result);
      return result;
    } catch (error) {
      // 3. Offline / quota / server error → serve last good copy if we have
      //    one. 401/403/404/etc. always propagate (isFallbackWorthy).
      if (error instanceof AdminApiError && isFallbackWorthy(error.status)) {
        const stale = readStale(key);
        if (stale !== null) {
          // Mark so UIs can show an "offline / cached" hint if they want to.
          try { (stale as Record<string, unknown>).__fromCache = true; } catch { /* primitives */ }
          return stale as T;
        }
      }
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
