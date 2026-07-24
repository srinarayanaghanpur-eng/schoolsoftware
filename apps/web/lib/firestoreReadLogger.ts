import type { QuerySnapshot } from "firebase-admin/firestore";

export function readLimit(value: string | null, fallback = 25, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.floor(parsed));
}

export function docCursor(value: string | null) {
  return value?.trim() || "";
}

export function logFirestoreRead(page: string, collectionName: string, snapshot: QuerySnapshot | null | undefined, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production") return;
  const size = snapshot?.size ?? 0;
  const filterText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== "" && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  console.log(
    `[Firestore Read] ${page} ${collectionName}${snapshot ? "" : " (unavailable)"} returned ${size} docs${filterText ? ` | ${filterText}` : ""} | estimatedReads=${size}`
  );
}

export function logFirestoreAggregateRead(page: string, collectionName: string, details: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "production") return;
  const filterText = Object.entries(details)
    .filter(([, value]) => value !== undefined && value !== "" && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  console.log(`[Firestore Aggregate] ${page} ${collectionName}${filterText ? ` | ${filterText}` : ""}`);
}
