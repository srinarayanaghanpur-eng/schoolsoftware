import { adminDb } from "@/lib/firebaseAdmin";
import { REQUEST_SOURCES, type RequestType } from "@/lib/communicationRequests";

// Retention policy for communication requests:
//  - Archived requests are permanently deleted 5 days after archiving.
//  - Any decided (approved/rejected/resolved) request is permanently deleted
//    10 days after it was raised, even if never archived.
// Attendance-edit audit logs are exempt (audit records are never auto-deleted).
export const ARCHIVE_RETENTION_DAYS = 5;
export const DECIDED_RETENTION_DAYS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_THROTTLE_MS = 60 * 60 * 1000; // run at most once per hour per server
const SCAN_LIMIT = 300;
const BATCH_LIMIT = 400;

let lastCleanupAt = 0;

// Decided (non-pending) native status values per source.
const DECIDED_STATUSES: Record<Exclude<RequestType, "attendance_edit">, string[]> = {
  password_reset: ["resolved", "rejected"],
  leave: ["approved", "rejected"]
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Purge expired communication requests. Throttled to once per hour per server
 * process and uses equality-only queries (auto-indexed) + in-memory date
 * filtering, so it needs no extra composite indexes and stays read-bounded.
 * Fire-and-forget from the list endpoint; failures are swallowed.
 */
export async function runCommunicationAutoCleanup(): Promise<void> {
  if (Date.now() - lastCleanupAt < CLEANUP_THROTTLE_MS) return;
  lastCleanupAt = Date.now();

  const db = adminDb();
  const now = Date.now();
  const archiveCutoff = new Date(now - ARCHIVE_RETENTION_DAYS * DAY_MS).toISOString();
  const decidedCutoff = new Date(now - DECIDED_RETENTION_DAYS * DAY_MS).toISOString();

  for (const type of ["password_reset", "leave"] as const) {
    const source = REQUEST_SOURCES[type];
    const toDelete = new Map<string, FirebaseFirestore.DocumentReference>();

    // Rule 1 — archived longer than ARCHIVE_RETENTION_DAYS (by archivedAt).
    const archived = await db.collection(source.collection).where("archived", "==", true).limit(SCAN_LIMIT).get();
    archived.docs.forEach((d) => {
      const at = String(d.data().archivedAt || d.data().updatedAt || "");
      if (at && at < archiveCutoff) toDelete.set(d.ref.path, d.ref);
    });

    // Rule 2 — decided longer than DECIDED_RETENTION_DAYS (by decision/request date).
    for (const status of DECIDED_STATUSES[type]) {
      const snap = await db.collection(source.collection).where("status", "==", status).limit(SCAN_LIMIT).get();
      snap.docs.forEach((d) => {
        const data = d.data();
        const decidedAt = String(data.reviewedAt || data.resolvedAt || data.requestedAt || data.createdAt || "");
        if (decidedAt && decidedAt < decidedCutoff) toDelete.set(d.ref.path, d.ref);
      });
    }

    for (const group of chunk([...toDelete.values()], BATCH_LIMIT)) {
      const batch = db.batch();
      group.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  }
}
