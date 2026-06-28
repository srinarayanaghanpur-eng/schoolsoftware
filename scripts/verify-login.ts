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
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const app = getApps().length ? getApps()[0] : initializeApp({
  credential: cert({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }),
});

const auth = getAuth(app);
const db = getFirestore(app);

async function main() {
  const email = "snhsparenty@srinarayana.local";
  
  try {
    const user = await auth.getUserByEmail(email);
    console.log(`✓ User exists in Firebase Auth:`);
    console.log(`  UID:         ${user.uid}`);
    console.log(`  Email:       ${user.email}`);
    console.log(`  DisplayName: ${user.displayName}`);
    console.log(`  Claims:      ${JSON.stringify(user.customClaims)}`);
    console.log(`  Disabled:    ${user.disabled}`);
    
    // Verify Firestore doc
    const doc = await db.collection("users").doc(user.uid).get();
    if (doc.exists) {
      const data = doc.data() as Record<string, unknown>;
      console.log(`\n✓ Firestore users/{uid} exists:`);
      console.log(`  Role:        ${data.role}`);
      console.log(`  Employee ID: ${data.employeeId}`);
    }
    
    // Verify links
    const links = await db.collection("parent_student_links")
      .where("parentUid", "==", user.uid)
      .get();
    console.log(`\n  Linked students: ${links.docs.length}`);
    links.docs.forEach((d) => {
      const l = d.data() as Record<string, unknown>;
      console.log(`  → ${l.studentId} (${l.relationship}, primary: ${l.isPrimary})`);
    });

    console.log(`\n✓ Ready! Login at /login with:`);
    console.log(`  ID: snhsparenty`);
    console.log(`  PW: Parent@2026`);
    
  } catch (err) {
    console.error(`✗ User "${email}" NOT found in Firebase Auth.`);
    console.error(`  Error:`, (err as Error).message);
    console.error(`\n  Re-run: npx tsx scripts/seed-parent.ts`);
  }
}

main().catch(console.error);
