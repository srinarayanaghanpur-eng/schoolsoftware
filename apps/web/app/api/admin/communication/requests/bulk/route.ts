import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, json } from "@/lib/apiUtils";
import { firestoreErrorResponse } from "@/lib/firebaseErrors";
import { ALL_TYPES, REQUEST_SOURCES, nativeStatusFor, sourceForType } from "@/lib/communicationRequests";

const MAX_ITEMS = 300;
const MAX_SCAN = 300;

type BulkItem = { id: string; type: string };

// POST /api/admin/communication/requests/bulk
// Body: { action, items?: [{id,type}], olderThanDays? }
// Actions: "archive" | "delete" | "clearRejected" | "clearApprovedOld"
export async function POST(req: Request) {
  const token = await requireAdmin(req);
  if (!token) return json({ ok: false, error: "Admin access required" }, { status: 403 });

  try {
    const body = await req.json();
    const action = String(body?.action ?? "");
    const db = adminDb();
    const now = new Date().toISOString();

    // --- Explicit selection: archive or soft-delete the given items ---
    if (action === "archive" || action === "delete") {
      const items: BulkItem[] = Array.isArray(body?.items) ? body.items.slice(0, MAX_ITEMS) : [];
      if (items.length === 0) return json({ ok: false, error: "No items selected" }, { status: 400 });

      const batch = db.batch();
      let affected = 0;
      for (const item of items) {
        const source = sourceForType(item.type);
        if (!source || !item.id) continue;
        // Never soft-delete a pending leave request in bulk (must be decided first).
        const ref = db.collection(source.collection).doc(item.id);
        if (action === "archive") {
          batch.set(ref, { archived: true, archivedAt: now, archivedBy: token.uid, updatedAt: now, updatedBy: token.uid }, { merge: true });
        } else {
          batch.set(ref, { deletedAt: now, deletedBy: token.uid, updatedAt: now, updatedBy: token.uid }, { merge: true });
        }
        affected += 1;
      }
      await batch.commit();
      return json({ ok: true, affected, message: `${affected} request(s) ${action === "archive" ? "archived" : "removed"}.` });
    }

    // --- Cleanup sweeps: archive rejected, or archive approved older than N days ---
    if (action === "clearRejected" || action === "clearApprovedOld") {
      const olderThanDays = action === "clearApprovedOld" ? Math.max(1, Number(body?.olderThanDays ?? 30)) : 0;
      const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
      const targetStatus = action === "clearRejected" ? "rejected" : "approved";

      let affected = 0;
      for (const type of ALL_TYPES) {
        const source = REQUEST_SOURCES[type];
        if (!source.hasStatus) continue;
        const native = nativeStatusFor(source, targetStatus);
        if (!native) continue;

        let query: FirebaseFirestore.Query = db.collection(source.collection).where("status", "==", native);
        if (action === "clearApprovedOld") query = query.where(source.dateField, "<", cutoff);
        const snap = await query.orderBy(source.dateField, "desc").limit(MAX_SCAN).get();
        if (snap.empty) continue;

        const batch = db.batch();
        snap.docs.forEach((doc) => {
          batch.set(doc.ref, { archived: true, archivedAt: now, archivedBy: token.uid, updatedAt: now, updatedBy: token.uid }, { merge: true });
        });
        await batch.commit();
        affected += snap.size;
      }
      return json({
        ok: true,
        affected,
        message: `${affected} ${targetStatus} request(s) archived.`,
        truncated: affected >= MAX_SCAN
      });
    }

    return json({ ok: false, error: "Unknown bulk action" }, { status: 400 });
  } catch (error) {
    return firestoreErrorResponse(error, "Unable to run bulk action", 400);
  }
}

