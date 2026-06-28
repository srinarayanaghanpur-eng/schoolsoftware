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
    if (line.trimStart().startsWith("#") || !line.trim()) continue;
    if (inQuotes) {
      currentVal.push(line);
      if (line.endsWith('"')) {
        inQuotes = false;
        env[currentKey!] = currentVal.join("\n").replace(/^"|"$/g, "").replace(/\\n/g, "\n");
        currentKey = null; currentVal = [];
      }
      continue;
    }
    const match = line.match(/^\s*([^=]+)=(.*)$/);
    if (!match) continue;
    const val = match[2].trim();
    if (val.startsWith('"') && !val.endsWith('"')) { inQuotes = true; currentKey = match[1].trim(); currentVal = [val]; }
    else { env[match[1].trim()] = val.replace(/^"|"$/g, "").replace(/\\n/g, "\n"); }
  }
  return env;
}

const env = loadEnvFile(path.resolve(__dirname, "../apps/web/.env.local"));
for (const [k, v] of Object.entries(env)) process.env[k] = v;

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }),
});

const db = getFirestore(app);

const PARENT_UID = "Ma3RiVQUP0VaQ3Ubum9EtH4odpe2";
const STUDENTS = [
  { id: "pIjcT5WSWVZaEcnYEkEc", name: "ananth" },
  { id: "x6E0ksENGmlAw8gYGCGX", name: "NARAYANA" },
];

async function main() {
  for (let i = 0; i < STUDENTS.length; i++) {
    const s = STUDENTS[i];
    const existing = await db.collection("parent_student_links")
      .where("parentUid", "==", PARENT_UID)
      .where("studentId", "==", s.id)
      .get();

    if (existing.docs.length > 0) {
      console.log(`Already linked to ${s.name} (${s.id})`);
      continue;
    }

    await db.collection("parent_student_links").add({
      parentUid: PARENT_UID,
      studentId: s.id,
      relationship: i === 0 ? "father" : "mother",
      isPrimary: i === 0,
      createdAt: new Date().toISOString(),
    });
    console.log(`✓ Linked to ${s.name} (${s.id})`);
  }

  console.log("\nDone! Login with:");
  console.log("  ID: snhsparenty");
  console.log("  PW: Parent@2026");
}

main().catch(console.error);
