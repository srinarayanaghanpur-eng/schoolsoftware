import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";

const BACKUP_COLLECTIONS = [
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
];

function serializeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if ("toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializeFirestoreValue(item)])
  );
}

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const db = adminDb();
    const generatedAt = new Date().toISOString();
    const collections: Record<string, Array<{ id: string; data: unknown }>> = {};

    for (const collectionName of BACKUP_COLLECTIONS) {
      const snapshot = await db.collection(collectionName).get();
      collections[collectionName] = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: serializeFirestoreValue(doc.data())
      }));
    }

    const backup = {
      appName: "SRI NARAYANA HIGH SCHOOL",
      backupType: "firestore-json",
      generatedAt,
      generatedBy: decodedToken.uid,
      collections
    };
    const payload = JSON.stringify(backup, null, 2);
    const checksum = createHash("sha256").update(payload).digest("hex");
    const fileName = `sri-narayana-backup-${generatedAt.slice(0, 10)}-${checksum.slice(0, 8)}.json`;

    await db.collection("backup_audit_logs").doc(checksum).set({
      checksum,
      fileName,
      generatedAt,
      generatedBy: decodedToken.uid,
      collectionNames: BACKUP_COLLECTIONS,
      documentCounts: Object.fromEntries(
        Object.entries(collections).map(([collectionName, docs]) => [collectionName, docs.length])
      ),
      usedForErase: false
    });

    return NextResponse.json({ ok: true, backup, checksum, fileName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate backup";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
