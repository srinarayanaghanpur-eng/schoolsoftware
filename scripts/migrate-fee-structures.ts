/**
 * migrate-fee-structures.ts
 * -------------------------
 * One-time migration for the fee-structures collection split.
 *
 * Historically two collections existed for the same concept:
 *   - `fee_structures`  (snake_case) — written by the admin API route. CANONICAL.
 *   - `feeStructures`   (camelCase)  — written by the legacy lib/feeService.ts.
 *
 * The code now uses `fee_structures` everywhere. This script copies any
 * documents that still live in the legacy `feeStructures` collection into
 * `fee_structures` so no data is lost. It is idempotent: a legacy doc is
 * skipped if a document with the same id already exists in the target.
 *
 * The legacy collection is NOT deleted automatically. After you confirm the
 * data looks correct in `fee_structures`, you can delete `feeStructures`
 * manually from the Firebase console (or re-run with --delete-legacy).
 *
 * Usage:
 *   npx ts-node scripts/migrate-fee-structures.ts
 *   npx ts-node scripts/migrate-fee-structures.ts --delete-legacy
 */

import * as fs from "fs";
import * as path from "path";

function loadEnvFile(filepath: string) {
  const content = fs.readFileSync(filepath, "utf-8");
  const lines = content.split("\n");
  const env: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentVal: string[] = [];
  let inQuotes = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trimStart().startsWith("#")) continue;
    if (line.trim() === "") continue;
    if (inQuotes) {
      currentVal.push(line);
      if (line.endsWith('"')) {
        inQuotes = false;
        const full = currentVal.join("\n");
        env[currentKey!] = full.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
        currentKey = null;
        currentVal = [];
      }
      continue;
    }
    const match = line.match(/^\s*([^=]+)=(.*)$/);
    if (!match) continue;
    const val = match[2].trim();
    if (val.startsWith('"') && !val.endsWith('"')) {
      inQuotes = true;
      currentKey = match[1].trim();
      currentVal = [val];
    } else {
      env[match[1].trim()] = val.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
    }
  }
  return env;
}

const env = loadEnvFile(path.resolve(__dirname, "../apps/web/.env.local"));
for (const [k, v] of Object.entries(env)) process.env[k] = v;

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY,
      }),
    });

const db = getFirestore(app);

const LEGACY = "feeStructures";
const CANONICAL = "fee_structures";
const deleteLegacy = process.argv.includes("--delete-legacy");

async function main() {
  const legacySnap = await db.collection(LEGACY).get();
  console.log(`Legacy '${LEGACY}' documents: ${legacySnap.size}`);
  if (legacySnap.empty) {
    console.log(`Nothing to migrate. '${CANONICAL}' is already the only collection.`);
    return;
  }

  let copied = 0;
  let skipped = 0;
  for (const docSnap of legacySnap.docs) {
    const targetRef = db.collection(CANONICAL).doc(docSnap.id);
    const existing = await targetRef.get();
    if (existing.exists) {
      skipped++;
      continue;
    }
    await targetRef.set(docSnap.data());
    copied++;
  }
  console.log(`Copied: ${copied}, Skipped (already present): ${skipped}`);

  if (deleteLegacy) {
    const batch = db.batch();
    legacySnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    console.log(`Deleted ${legacySnap.size} documents from legacy '${LEGACY}'.`);
  } else {
    console.log(
      `Legacy '${LEGACY}' left intact. Re-run with --delete-legacy once you've verified '${CANONICAL}'.`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
