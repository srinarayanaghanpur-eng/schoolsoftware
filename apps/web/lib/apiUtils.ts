import type { DecodedIdToken } from "firebase-admin/auth";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { verifyBearerToken } from "./firebaseAdmin";

export async function requireAdmin(req: Request): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken || decodedToken.role !== "admin") {
    return null;
  }
  return decodedToken;
}

export async function requireSignedIn(req: Request): Promise<DecodedIdToken | null> {
  return verifyBearerToken(req);
}

export async function requireTeacher(req: Request): Promise<DecodedIdToken | null> {
  const decodedToken = await verifyBearerToken(req);
  if (!decodedToken || decodedToken.role !== "teacher") {
    return null;
  }
  return decodedToken;
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
