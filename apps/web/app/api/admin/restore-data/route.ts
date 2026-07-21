import { adminDb } from "@/lib/firebaseAdmin";
import { requireSuperAdmin, json } from "@/lib/apiUtils";

const RESTORABLE_COLLECTIONS = new Set([
  "users",
  "teachers",
  "attendance",
  "attendance_logs",
  "biometric_logs",
  "holidays",
  "salary_reports",
  "settings",
  "password_reset_requests",
  "password_reset_history",
  "leave_requests",
  "attendance_edit_audit_logs",
  "admin_notifications"
]);

type BackupEntry = {
  id?: unknown;
  data?: unknown;
};

function normalizeEntries(entries: unknown): Array<{ id?: string; data: Record<string, unknown> }> {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as BackupEntry & Record<string, unknown>;
      if (typeof item.id === "string" && item.data && typeof item.data === "object") {
        return { id: item.id, data: item.data as Record<string, unknown> };
      }
      if (typeof item.id === "string") {
        return { id: item.id, data: item };
      }
      return { data: item };
    })
    .filter((entry): entry is { id?: string; data: Record<string, unknown> } => Boolean(entry));
}

export async function POST(req: Request) {
  try {
    const decodedToken = await requireSuperAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Super admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const collections = body.backup?.collections;
    if (!collections || typeof collections !== "object") {
      return json({ ok: false, error: "Backup file does not contain collections" }, { status: 400 });
    }

    const db = adminDb();
    const restoredCounts: Record<string, number> = {};
    let batch = db.batch();
    let batchCount = 0;

    for (const [collectionName, entries] of Object.entries(collections as Record<string, unknown>)) {
      if (!RESTORABLE_COLLECTIONS.has(collectionName)) continue;
      const normalizedEntries = normalizeEntries(entries);
      restoredCounts[collectionName] = 0;

      for (const entry of normalizedEntries) {
        const docRef = entry.id ? db.collection(collectionName).doc(entry.id) : db.collection(collectionName).doc();
        batch.set(docRef, entry.data, { merge: true });
        restoredCounts[collectionName] += 1;
        batchCount += 1;

        if (batchCount >= 400) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    await db.collection("admin_audit_logs").add({
      action: "restore_data_from_backup",
      restoredCounts,
      createdAt: new Date().toISOString(),
      createdBy: decodedToken.uid
    });

    return json({ ok: true, restoredCounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to restore data";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

