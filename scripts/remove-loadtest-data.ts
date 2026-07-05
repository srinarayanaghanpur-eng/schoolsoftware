import * as fs from "fs";
import * as path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type EnvMap = Record<string, string>;

// Same run id the seed script (seed-capacity-data.ts) tags every document with.
const RUN_ID = process.env.LOADTEST_RUN_ID || "capacity-test";

// Every collection the seed script writes into, tagged with loadTestRunId.
const COLLECTIONS = ["students", "teachers", "users", "payments", "receipts", "vehicles"];

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

async function deleteDocs(
  db: FirebaseFirestore.Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
) {
  let deleted = 0;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 450)) batch.delete(doc.ref);
    await batch.commit();
    deleted += Math.min(450, docs.length - i);
  }
  return deleted;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { auth, db } = getServices();

  console.log(`Load-test run id: "${RUN_ID}"${dryRun ? "  (DRY RUN)" : ""}\n`);

  // Collect teacher auth emails BEFORE deleting the teacher docs.
  const teacherSnap = await db.collection("teachers").where("loadTestRunId", "==", RUN_ID).get();
  const teacherEmails = teacherSnap.docs
    .map((doc) => doc.data().internalEmail)
    .filter((email): email is string => typeof email === "string" && email.length > 0);

  const collectionCounts: Record<string, number> = {};
  const collectionSnaps: Record<string, FirebaseFirestore.QuerySnapshot> = {};

  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).where("loadTestRunId", "==", RUN_ID).get();
    collectionSnaps[name] = snap;
    collectionCounts[name] = snap.size;
    console.log(`  ${name}: ${snap.size} document(s)`);
  }
  console.log(`  auth users (teachers): ${teacherEmails.length}\n`);

  const totalDocs = Object.values(collectionCounts).reduce((a, b) => a + b, 0);
  if (totalDocs === 0 && teacherEmails.length === 0) {
    console.log("No load-test data found. Nothing to remove.");
    return;
  }

  if (dryRun) {
    console.log("Dry run: nothing was deleted. Re-run without --dry-run to delete.");
    return;
  }

  for (const name of COLLECTIONS) {
    const snap = collectionSnaps[name];
    if (snap.empty) continue;
    const deleted = await deleteDocs(db, snap.docs);
    console.log(`Deleted ${deleted} from ${name}.`);
  }

  let authDeleted = 0;
  for (const email of teacherEmails) {
    try {
      const user = await auth.getUserByEmail(email);
      await auth.deleteUser(user.uid);
      authDeleted += 1;
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code !== "auth/user-not-found") throw error;
    }
  }
  console.log(`Deleted ${authDeleted} teacher auth user(s).`);

  console.log("\nLoad-test data cleanup complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
