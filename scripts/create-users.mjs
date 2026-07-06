/**
 * Creates/updates the two login accounts:
 *   Login ID: ADMIN   Password: Admin@2026   Role: settings_manager (shown as "Admin")
 *   Login ID: SWAPNA  Password: Swapna@2026  Role: principal
 *
 * Run from repo root (needs the same Firebase Admin env vars as the web app,
 * e.g. from apps/web/.env.local):
 *   node --env-file=apps/web/.env.local scripts/create-users.mjs
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const DOMAIN = "srinarayana.local";

function serviceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    return {
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    };
  }
  throw new Error("Missing Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/NEXT_PUBLIC_FIREBASE_PROJECT_ID).");
}

const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount()) });
const auth = getAuth(app);
const db = getFirestore(app);

const USERS = [
  { loginId: "ADMIN", password: "Admin@2026", role: "settings_manager", displayName: "Admin" },
  { loginId: "SWAPNA", password: "Swapna@2026", role: "principal", displayName: "Swapna" }
];

for (const u of USERS) {
  const email = `${u.loginId.toLowerCase()}@${DOMAIN}`;
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: u.password, displayName: u.displayName });
    console.log(`Updated ${u.loginId} (${email})`);
  } catch {
    user = await auth.createUser({ email, password: u.password, displayName: u.displayName });
    console.log(`Created ${u.loginId} (${email})`);
  }
  await auth.setCustomUserClaims(user.uid, { role: u.role });
  await db.collection("users").doc(user.uid).set(
    {
      role: u.role,
      displayName: u.displayName,
      employeeId: u.loginId,
      employeeIdLower: u.loginId.toLowerCase(),
      internalEmail: email,
      updatedAt: new Date().toISOString()
    },
    { merge: true }
  );
  console.log(`  role=${u.role}, claim + users doc set`);
}

console.log("Done.");
