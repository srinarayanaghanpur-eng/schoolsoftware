import { createHash } from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin, json } from "@/lib/apiUtils";
import {
  createBackupManifest,
  isPreservedCollection,
  serializeFirestoreValue
} from "@/lib/backupManifest";

export async function GET(req: Request) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const db = adminDb();
    const generatedAt = new Date().toISOString();
    const collectionNames = (await db.listCollections())
      .map((collection) => collection.id)
      .filter((name) => !isPreservedCollection(name))
      .sort();
    const collections: Record<string, Array<{ id: string; data: unknown }>> = {};

    for (const collectionName of collectionNames) {
      const snapshot = await db.collection(collectionName).get();
      collections[collectionName] = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: serializeFirestoreValue(doc.data())
      }));
    }

    const manifest = createBackupManifest(collections);
    const backup = {
      appName: "SRI NARAYANA HIGH SCHOOL",
      backupType: "firestore-json",
      manifestVersion: manifest.manifestVersion,
      generatedAt,
      generatedBy: decodedToken.uid,
      manifest,
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
      manifestVersion: manifest.manifestVersion,
      collectionNames: manifest.collectionNames,
      documentCounts: manifest.documentCounts,
      totalDocuments: Object.values(manifest.documentCounts).reduce(
        (sum, count) => sum + count,
        0
      ),
      usedForErase: false
    });

    return json({ ok: true, backup, checksum, fileName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate backup";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
