import type { DecodedIdToken } from "firebase-admin/auth";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { isValidRole, type Permission, type Role } from "@sri-narayana/shared";
import { adminDb, verifyBearerToken } from "./firebaseAdmin";
import { roleHasAllPermissions, roleHasAnyPermission, roleHasPermission } from "./rbacAdmin";

/**
 * Effective role for a request. Prefers the Firestore `users/{uid}` assignment
 * and falls back to the token's custom claim when the document role is missing
 * or temporarily unavailable. This keeps API access in sync with the role the
 * admin manages in the database, even if a user's custom claim is stale. The
 * resolved role is patched back onto the token so existing `decodedToken.role`
 * reads keep working.
 */
export async function resolveRole(decodedToken: DecodedIdToken): Promise<Role | undefined> {
  const claimRole = decodedToken.role;
  const fallbackRole = isValidRole(claimRole) ? claimRole : undefined;
  try {
    const snapshot = await adminDb().collection("users").doc(decodedToken.uid).get();
    const docRole = snapshot.exists ? (snapshot.data() as { role?: unknown })?.role : undefined;
    if (isValidRole(docRole)) {
      (decodedToken as { role?: string }).role = docRole;
      return docRole;
    }
  } catch {
    // Firestore unavailable — fall back to the refreshed token claim.
  }
  if (fallbackRole) {
    (decodedToken as { role?: string }).role = fallbackRole;
    return fallbackRole;
  }
  return undefined;
}

export async function requireAdmin(req: Request): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  if (role !== "super_admin" && role !== "admin" && role !== "settings_manager") return null;
  return decodedToken;
}

/** Allow the request only for super_admin (used for hard deletes of records). */
export async function requireSuperAdmin(req: Request): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  if (role !== "super_admin") return null;
  return decodedToken;
}

export async function requireSignedIn(req: Request): Promise<DecodedIdToken | null> {
  return verifyBearerToken(req);
}

export async function requireTeacher(req: Request): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  if (role !== "teacher") {
    return null;
  }
  return decodedToken;
}

/** Allow the request only if the signed-in user's role is in `roles`. */
export async function requireRole(req: Request, roles: Role[]): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  // super_admin has all permissions, so it is always allowed regardless of `roles`.
  if (!role || (role !== "super_admin" && !roles.includes(role))) {
    return null;
  }
  return decodedToken;
}

/** Allow the request only if the signed-in user's role grants `permission`. */
export async function requirePermission(req: Request, permission: Permission): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  if (!await roleHasPermission(role, permission)) {
    return null;
  }
  return decodedToken;
}

/**
 * Same as requirePermission but returns a descriptive error message instead of null.
 * Makes it easier to show the missing permission in the API response.
 */
export async function checkPermissionWithMessage(req: Request, permission: Permission, decodedToken?: DecodedIdToken | null): Promise<{ ok: true; token: DecodedIdToken } | { ok: false; error: string; status: 403 }> {
  if (!decodedToken) {
    decodedToken = await verifyBearerToken(req);
  }
  if (!decodedToken) {
    return { ok: false, error: "Authentication required. Please sign in.", status: 403 };
  }
  const role = await resolveRole(decodedToken);
  if (!role || !await roleHasPermission(role, permission)) {
    return { ok: false, error: `Access denied. Missing permission: ${permission}. Ask super admin to enable this permission for your role.`, status: 403 };
  }
  return { ok: true, token: decodedToken };
}

/** Allow the request only if the signed-in user's role grants every permission. */
export async function requireAllPermissions(req: Request, permissions: readonly Permission[]): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  if (!await roleHasAllPermissions(role, permissions)) return null;
  return decodedToken;
}

/** Allow the request if the signed-in user's role grants at least one permission. */
export async function requireAnyPermission(req: Request, permissions: readonly Permission[]): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken) return null;
  const role = await resolveRole(decodedToken);
  if (!await roleHasAnyPermission(role, permissions)) return null;
  return decodedToken;
}

/**
 * Turn any thrown value into a human-readable message.
 *
 * Zod validation errors are `Error`s whose `.message` is a raw JSON array of
 * issues (e.g. `[{"code":"too_small",...}]`). Surfacing that to users dumps
 * unreadable JSON on screen, so we detect Zod errors (duck-typed via `issues`,
 * to survive multiple zod copies across the monorepo) and return the first
 * issue's friendly message instead — "Password must be at least 8 characters".
 */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: Array<{ message?: string }> }).issues;
    if (Array.isArray(issues) && issues.length > 0 && issues[0]?.message) {
      return issues[0].message;
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if ("toDate" in value && typeof value.toDate === "function") {
    return (value.toDate() as Date).toISOString();
  }
  if (Array.isArray(value)) return value.map(normalizeFirestoreValue);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeFirestoreValue(item)])
  );
}

export function serializeDoc<T extends Record<string, unknown>>(doc: QueryDocumentSnapshot): T & { id: string } {
  return {
    id: doc.id,
    ...(normalizeFirestoreValue(doc.data()) as T)
  };
}

/**
 * Performance monitoring utility for API endpoints
 * Logs timing information for database operations, API calls, and overall request time
 * Usage: const timer = startTimer(); ... const elapsed = timer(); console.log(`Operation took ${elapsed}ms`);
 */
export function startTimer(): () => number {
  const start = process.hrtime.bigint();
  return () => {
    const end = process.hrtime.bigint();
    return Number((end - start) / BigInt(1_000_000)); // Convert to milliseconds
  };
}

/**
 * Wrap an API response with performance metrics
 * Automatically measures total request time and logs slow endpoints
 */
export async function withPerformanceTracking<T extends Record<string, any>>(
  operationName: string,
  handler: () => Promise<T>
): Promise<T & { _metrics?: { operationMs: number; totalMs: number } }> {
  const totalTimer = startTimer();
  const timer = startTimer();
  const result = await handler();
  const operationMs = timer();
  const totalMs = totalTimer();
  
  // Log to console if slow (> 500ms)
  if (totalMs > 500) {
    console.warn(`[PERF] ${operationName} took ${totalMs}ms (operation: ${operationMs}ms)`);
  } else if (totalMs > 100) {
    console.log(`[PERF] ${operationName} took ${totalMs}ms`);
  }
  
  // Optionally add metrics to response for monitoring
  return {
    ...result,
    _metrics: { operationMs, totalMs }
  };
}
