/**
 * Link existing transport drivers to staff/user accounts.
 *
 * Dry-run by default: prints what would be linked without writing anything.
 *
 *   node --env-file=apps/web/.env.local scripts/driver-migration.mjs
 *   node --env-file=apps/web/.env.local scripts/driver-migration.mjs --apply
 *   node --env-file=apps/web/.env.local scripts/driver-migration.mjs --apply --create
 *
 * --create also creates a login for drivers that have no matching account.
 * It requires DRIVER_DEFAULT_PASSWORD (never hardcode a password here).
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");
const CREATE = process.argv.includes("--create");
const PASSWORD = process.env.DRIVER_DEFAULT_PASSWORD;
const DOMAIN = process.env.DRIVER_LOGIN_DOMAIN || "srinarayana.local";
const PRIVILEGED = new Set(["super_admin", "admin", "settings_manager"]);

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  }
  if (
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ) {
    return {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }
  throw new Error(
    "Missing Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/NEXT_PUBLIC_FIREBASE_PROJECT_ID)."
  );
}

if (CREATE && !PASSWORD) {
  console.error("Refusing to create accounts: set DRIVER_DEFAULT_PASSWORD.");
  process.exit(1);
}

const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount()) });
const auth = getAuth(app);
const db = getFirestore(app);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function normalizeName(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function pushTo(map, key, value) {
  if (!key) return;
  const list = map.get(key) ?? [];
  list.push(value);
  map.set(key, list);
}

function unique(list) {
  return Array.from(new Map(list.map((item) => [item.uid, item])).values());
}

async function listAuthUsers() {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

const [driversSnap, usersSnap, teachersSnap, authUsers] = await Promise.all([
  db.collection("drivers").limit(1000).get(),
  db.collection("users").limit(2000).get(),
  db.collection("teachers").limit(1000).get(),
  listAuthUsers()
]);

const authByUid = new Map(authUsers.map((user) => [user.uid, user]));
const authByEmail = new Map(
  authUsers.filter((user) => user.email).map((user) => [user.email.toLowerCase(), user])
);

const accounts = usersSnap.docs.map((doc) => ({
  uid: doc.id,
  ...(doc.data() ?? {})
}));

for (const doc of teachersSnap.docs) {
  const data = doc.data() ?? {};
  const uid = text(data.uid);
  if (!uid || accounts.some((item) => item.uid === uid)) continue;
  accounts.push({
    uid,
    role: "teacher",
    displayName: text(data.fullName) || text(data.name),
    phone: text(data.phone)
  });
}

const byPhone = new Map();
const byName = new Map();
for (const account of accounts) {
  const role = text(account.role);
  if (PRIVILEGED.has(role)) continue;
  pushTo(byPhone, normalizePhone(account.phone), account);
  pushTo(byPhone, normalizePhone(account.mobile), account);
  pushTo(byName, normalizeName(account.displayName), account);
  pushTo(byName, normalizeName(account.name), account);
}

function findMatch(driver) {
  const phoneKey = normalizePhone(driver.phone);
  const nameKey = normalizeName(driver.name);
  const phoneMatches = unique(phoneKey ? byPhone.get(phoneKey) ?? [] : []);
  const nameMatches = unique(nameKey ? byName.get(nameKey) ?? [] : []);

  if (phoneMatches.length === 1) return { account: phoneMatches[0], match: "phone" };
  if (nameMatches.length === 1) return { account: nameMatches[0], match: "name" };
  if (phoneMatches.length > 1) return { conflict: "Phone matches multiple accounts" };
  if (nameMatches.length > 1) return { conflict: "Name matches multiple accounts" };
  return {};
}

function loginEmail(driver) {
  const raw =
    text(driver.employeeId) ||
    normalizePhone(driver.phone) ||
    `driver${text(driver.id).slice(0, 6)}` ||
    "driver";
  const loginId = raw.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase() || "driver";
  return `${loginId}@${DOMAIN}`;
}

async function linkDriver(driverId, driver, uid, source) {
  const existingAuth = authByUid.get(uid);
  if (!existingAuth) throw new Error(`Auth user ${uid} not found`);

  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() ?? {};
  const role = text(userData.role) || text(existingAuth.customClaims?.role);
  if (PRIVILEGED.has(role)) throw new Error("Matched account is privileged");

  const linked = await db.collection("drivers").where("uid", "==", uid).limit(10).get();
  if (linked.docs.some((doc) => doc.id !== driverId)) {
    throw new Error("Account is already linked to another driver");
  }

  const status = text(driver.status) || "active";
  const vehicleId = text(driver.vehicleId);
  const mode = text(driver.mode) || "daily";

  if (!APPLY) {
    console.log(`  would link ${driver.name} (${driverId}) -> ${text(userData.displayName) || uid} via ${source}`);
    return;
  }

  await db.collection("drivers").doc(driverId).set(
    {
      uid,
      status,
      mode,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const userPatch = {
    uid,
    role: "driver",
    driverId,
    vehicleId,
    status,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (text(driver.name) && !text(userData.displayName)) userPatch.displayName = text(driver.name);
  if (text(driver.phone) && !text(userData.phone)) userPatch.phone = text(driver.phone);
  await userRef.set(userPatch, { merge: true });

  await auth.setCustomUserClaims(uid, {
    ...(existingAuth.customClaims ?? {}),
    role: "driver",
    driverId,
    vehicleId,
    status
  });
  await auth.revokeRefreshTokens(uid);

  await db.collection("audit_logs").add({
    action: "driver.linked",
    entityType: "driver",
    entityId: driverId,
    actorId: "driver-migration-script",
    actorRole: "system",
    newValues: { uid, driverId, vehicleId, status },
    createdAt: FieldValue.serverTimestamp()
  });

  console.log(`  linked ${driver.name} (${driverId}) -> ${uid} via ${source}`);
}

async function createDriver(driverId, driver) {
  const email = loginEmail(driver);
  const existing = authByEmail.get(email.toLowerCase());
  if (existing) {
    return linkDriver(driverId, driver, existing.uid, "existing login");
  }

  if (!APPLY) {
    console.log(`  would create login ${email} and link driver ${driver.name} (${driverId})`);
    return;
  }

  const created = await auth.createUser({
    email,
    password: PASSWORD,
    displayName: text(driver.name) || "Driver"
  });
  await linkDriver(driverId, driver, created.uid, "created login");
  console.log(`  created ${email}`);
}

const summary = {
  drivers: driversSnap.size,
  alreadyLinked: 0,
  linked: 0,
  created: 0,
  unmatched: 0,
  conflicts: 0
};

console.log(`\nDriver migration (${APPLY ? "APPLY" : "DRY RUN"})\n`);

for (const doc of driversSnap.docs) {
  const driver = { id: doc.id, ...(doc.data() ?? {}) };
  const name = text(driver.name) || doc.id;
  const uid = text(driver.uid);

  if (uid && authByUid.has(uid)) {
    summary.alreadyLinked += 1;
    console.log(`- ${name}: already linked (${uid})`);
    continue;
  }

  const direct = accounts.find(
    (account) =>
      text(account.driverId) === doc.id &&
      authByUid.has(account.uid) &&
      !PRIVILEGED.has(text(account.role))
  );
  if (direct) {
    summary.linked += 1;
    await linkDriver(doc.id, driver, direct.uid, "driverId");
    continue;
  }

  const found = findMatch(driver);
  if (found.conflict) {
    summary.conflicts += 1;
    console.log(`- ${name}: CONFLICT — ${found.conflict}`);
    continue;
  }
  if (found.account) {
    summary.linked += 1;
    await linkDriver(doc.id, driver, found.account.uid, found.match);
    continue;
  }

  if (CREATE) {
    summary.created += 1;
    await createDriver(doc.id, driver);
    continue;
  }

  summary.unmatched += 1;
  console.log(`- ${name}: no matching account (use --create or link it from the admin Drivers page)`);
}

console.log("\nSummary:", summary);
if (!APPLY) console.log("\nNo changes written. Re-run with --apply to persist.");
