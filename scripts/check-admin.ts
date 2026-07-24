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
  const list = await auth.listUsers(100);
  console.log("Firebase Auth users:");
  for (const u of list.users) {
    console.log(`  ${u.email || "(no email)"} | uid: ${u.uid.slice(0, 16)}... | claims: ${JSON.stringify(u.customClaims)} | disabled: ${u.disabled}`);
  }

  console.log("\nFirestore users collection:");
  const snap = await db.collection("users").limit(20).get();
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    console.log(`  ${d.id.slice(0, 16)}... | role: ${data.role} | employeeId: ${data.employeeId || "-"}`);
  }
}

main().catch(console.error);
