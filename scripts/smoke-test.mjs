import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// --- load env from .env.local ---
const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_KEY);
sa.private_key = sa.private_key.replace(/\\n/g, "\n");
const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const BASE = process.env.SMOKE_BASE || "https://srinarayanahighschool.vercel.app";
const month = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);

initializeApp({ credential: cert(sa) });

// 1) mint custom token with admin role claim, 2) exchange for ID token
const customToken = await getAuth().createCustomToken("smoke-admin", { role: "admin" });
const exch = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
  { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
);
const exchJson = await exch.json();
if (!exchJson.idToken) {
  console.error("Failed to get ID token:", exchJson);
  process.exit(1);
}
const idToken = exchJson.idToken;
console.log(`Auth OK. Base: ${BASE}\n`);

const endpoints = [
  ["GET", "/api/admin/reports/dashboard-stats"],
  ["GET", "/api/admin/concessions"],
  ["GET", "/api/admin/students"],
  ["GET", "/api/admin/payments"],
  ["GET", "/api/admin/reports/class-wise"],
  ["GET", "/api/admin/reports/student-wise"],
  ["GET", "/api/admin/reports/attendance-fee"],
  ["GET", `/api/admin/salary?month=${month}`],
  ["GET", "/api/admin/attendance"],
  ["GET", "/api/admin/teachers"],
  ["GET", "/api/admin/holidays"],
  ["GET", "/api/admin/leave-requests"],
  ["GET", "/api/admin/password-reset-requests"],
  ["GET", "/api/admin/gps-settings"],
  ["GET", `/api/reports/daily?date=${today}`],
];

let pass = 0, fail = 0;
for (const [method, path] of endpoints) {
  try {
    const res = await fetch(BASE + path, { method, headers: { authorization: `Bearer ${idToken}` } });
    const text = await res.text();
    let summary = "";
    try {
      const j = JSON.parse(text);
      const arr = j.reports || j.data || j.teachers || j.holidays || j.requests || j.records || j.attendance;
      if (Array.isArray(arr)) summary = `count=${arr.length}`;
      else if (j.data && typeof j.data === "object") summary = `keys=${Object.keys(j.data).length}`;
      else if (j.ok === true || j.success === true) summary = "ok";
    } catch { summary = text.slice(0, 80).replace(/\n/g, " "); }
    const ok = res.status >= 200 && res.status < 300;
    if (ok) pass++; else fail++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${res.status}  ${path}  ${summary}`);
  } catch (e) {
    fail++;
    console.log(`FAIL  ERR  ${path}  ${e.message}`);
  }
}
console.log(`\n${pass} passed, ${fail} failed of ${endpoints.length}`);
process.exit(fail ? 1 : 0);
