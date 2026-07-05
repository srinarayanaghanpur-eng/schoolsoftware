import * as fs from "fs";
import * as path from "path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

type EnvMap = Record<string, string>;

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

function getDb() {
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

  return getFirestore(app);
}

// Explicit, user-named vehicles to remove. Each regNo maps to the seed doc id
// `loadtest_vehicle_<NNN>` created by seed-capacity-data.ts.
const TARGET_REG_NOS = [
  "TS09LT0001",
  "TS09LT0002",
  "TS09LT0003",
  "TS09LT0004",
  "TS09LT0005",
  "TS09LT0006",
  "TS09LT0007",
  "TS09LT0008",
  "TS09LT0009",
  "TS09LT0010"
];

function docIdForRegNo(regNo: string) {
  const num = Number(regNo.replace("TS09LT", ""));
  return `loadtest_vehicle_${String(num).padStart(3, "0")}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = getDb();

  const refs = TARGET_REG_NOS.map((regNo) => ({
    regNo,
    ref: db.collection("vehicles").doc(docIdForRegNo(regNo))
  }));

  const found: Array<{ regNo: string; ref: FirebaseFirestore.DocumentReference }> = [];
  for (const item of refs) {
    const snap = await item.ref.get();
    if (!snap.exists) {
      console.log(`  - ${item.regNo}: not found (already removed), skipping`);
      continue;
    }
    const data = snap.data() ?? {};
    console.log(`  - ${item.regNo} (${data.driverName ?? "no driver"}) [${item.ref.id}]`);
    found.push(item);
  }

  if (found.length === 0) {
    console.log("No matching vehicles found. Nothing to remove.");
    return;
  }

  if (dryRun) {
    console.log(`\nDry run: ${found.length} vehicle(s) would be deleted. Re-run without --dry-run to delete.`);
    return;
  }

  const batch = db.batch();
  for (const item of found) batch.delete(item.ref);
  await batch.commit();

  console.log(`\nRemoved ${found.length} vehicle(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
