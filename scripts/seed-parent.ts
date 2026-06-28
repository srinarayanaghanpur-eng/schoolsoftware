import * as fs from "fs";
import * as path from "path";

// Load .env.local manually to handle multi-line values (private key)
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
        const trimmed = full.replace(/^"|"$/g, "");
        env[currentKey!] = trimmed.replace(/\\n/g, "\n");
        currentKey = null;
        currentVal = [];
      }
      continue;
    }

    const match = line.match(/^\s*([^=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    let val = match[2].trim();

    if (val.startsWith('"') && !val.endsWith('"')) {
      inQuotes = true;
      currentKey = key;
      currentVal = [val];
    } else {
      env[key] = val.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
    }
  }

  return env;
}

const envPath = path.resolve(__dirname, "../apps/web/.env.local");
const env = loadEnvFile(envPath);

// Set env vars for firebase-admin
for (const [k, v] of Object.entries(env)) {
  process.env[k] = v;
}

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const LOGIN_ID = "snhsparenty";
const PASSWORD = "Parent@2026";
const FULL_NAME = "SNHS Parent";
const INTERNAL_EMAIL = `${LOGIN_ID.toLowerCase()}@srinarayana.local`;

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials in .env.local");
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

async function seedParent() {
  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    const existing = await auth.getUserByEmail(INTERNAL_EMAIL);
    console.log(`Parent "${LOGIN_ID}" already exists with uid: ${existing.uid}`);
    console.log(`Login with ID: "${LOGIN_ID}" / password: "${PASSWORD}"`);
    return;
  } catch {
    // doesn't exist
  }

  const user = await auth.createUser({
    email: INTERNAL_EMAIL,
    password: PASSWORD,
    displayName: FULL_NAME,
  });

  await auth.setCustomUserClaims(user.uid, { role: "parent" });

  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    role: "parent",
    employeeId: LOGIN_ID.toUpperCase(),
    displayName: FULL_NAME,
    email: INTERNAL_EMAIL,
    phone: "",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`✓ Parent created!`);
  console.log(`  Login ID : ${LOGIN_ID}`);
  console.log(`  Password : ${PASSWORD}`);
  console.log(`  UID      : ${user.uid}`);
  console.log(``);
  console.log(`To link this parent to a student, run:`);
  console.log(`  POST /api/admin/parent-student-links`);
  console.log(`  Body: { "parentUid": "${user.uid}", "studentId": "<student-id>", "relationship": "father", "isPrimary": true }`);
}

seedParent().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
