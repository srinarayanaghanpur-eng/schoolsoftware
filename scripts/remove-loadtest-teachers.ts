import * as fs from "fs";
import * as path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type EnvMap = Record<string, string>;

// Explicit, deterministic set of load-test teacher accounts created by
// seed-capacity-data.ts. employeeId = `LT-TCH-001`..`LT-TCH-020`, and the seed
// derives the auth email as `${employeeId.toLowerCase()}@srinarayana.local`.
const TEACHER_COUNT = 20;
const TARGET_EMAILS = Array.from(
  { length: TEACHER_COUNT },
  (_, i) => `lt-tch-${String(i + 1).padStart(3, "0")}@srinarayana.local`
);

function loadEnvFile(filepath: string): EnvMap {
  if (!fs.existsSync(filepath)) return {};
  const content = fs.readFileSync(filepath, "utf-8");
  const env: EnvMap = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];
  let inQuotes = false;

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (line.trimStart().startsWith("#") || (!inQuotes && line.trim() === "")) continue;

    if (inQuotes) {
      currentValue.push(line);
      if (line.endsWith('"')) {
        inQuotes = false;
        env[currentKey!] = currentValue.join("\n").replace(/^"|"$/g, "").replace(/\\n/g, "\n");
        currentKey = null;
        currentValue = [];
      }
      continue;
    }

    const match = line.match(/^\s*([^=]+)=(.*)$/);
    if (!match) continue;
    const value = match[2].trim();
    if (value.startsWith('"') && !value.endsWith('"')) {
      inQuotes = true;
      currentKey = match[1].trim();
      currentValue = [value];
    } else {
      env[match[1].trim()] = value.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
    }
  }

  return env;
}

function loadLocalEnv() {
  const env = loadEnvFile(path.resolve(__dirname, "../apps/web/.env.local"));
  for (const [key, value] of Object.entries(env)) {
    if (!process.env[key]) process.env[key] = value;
  }
}

function getServices() {
  loadLocalEnv();
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin credentials are missing in apps/web/.env.local.");
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });

  return { auth: getAuth(app), db: getFirestore(app) };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { auth, db } = getServices();

  console.log(`Removing ${TARGET_EMAILS.length} named load-test teacher account(s)${dryRun ? "  (DRY RUN)" : ""}\n`);

  let authToDelete = 0;
  let docsToDelete = 0;
  let authDeleted = 0;
  let docsDeleted = 0;

  for (const email of TARGET_EMAILS) {
    // 1) users collection doc(s) for this exact email.
    const userSnap = await db.collection("users").where("internalEmail", "==", email).get();
    // 2) auth account for this exact email.
    let uid: string | null = null;
    try {
      uid = (await auth.getUserByEmail(email)).uid;
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code !== "auth/user-not-found") throw error;
    }

    if (userSnap.empty && !uid) {
      console.log(`  ${email}: not found, skipping`);
      continue;
    }
    console.log(`  ${email}: ${userSnap.size} users doc(s)${uid ? ", 1 auth user" : ""}`);
    docsToDelete += userSnap.size;
    if (uid) authToDelete += 1;

    if (dryRun) continue;

    for (const doc of userSnap.docs) {
      await doc.ref.delete();
      docsDeleted += 1;
    }
    if (uid) {
      await auth.deleteUser(uid);
      authDeleted += 1;
    }
  }

  if (dryRun) {
    console.log(`\nDry run: would delete ${docsToDelete} users doc(s) and ${authToDelete} auth user(s).`);
    return;
  }

  console.log(`\nDeleted ${docsDeleted} users doc(s) and ${authDeleted} auth user(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
