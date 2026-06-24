/**
 * eSSL / ZKTeco -> attendance app bridge.
 *
 * Reads attendance punches from a biometric device over the LAN (TCP 4370)
 * and forwards them to the app's POST /api/biometric/log endpoint, which already
 * knows how to look up the teacher (by biometricUserId) and mark attendance.
 *
 * Usage:
 *   node sync.mjs           Run once (ideal for Windows Task Scheduler / cron).
 *   node sync.mjs --loop    Keep running, polling every POLL_INTERVAL_SECONDS.
 *   node sync.mjs --test    Just connect to the device and print a few raw punches.
 *
 * The device speaks ZKTeco protocol, not JSON. node-zklib does the talking.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ZKLib from "node-zklib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, ".state.json");

// node-zklib can emit errors outside the promise chain when it talks to a host
// that isn't actually an eSSL device (e.g. a wrong DEVICE_IP). Fail with a clear
// message instead of a raw library stack trace.
process.on("uncaughtException", (err) => {
  console.error(`Device communication error — check DEVICE_IP / DEVICE_PORT and that it's an eSSL device.\n  ${err.message}`);
  process.exit(1);
});

// ---------- tiny .env loader (no extra dependency) ----------
function loadEnv() {
  const path = join(__dirname, ".env");
  if (!existsSync(path)) {
    console.error("Missing .env file. Copy .env.example to .env and fill it in.");
    process.exit(1);
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const CFG = {
  deviceIp: process.env.DEVICE_IP,
  devicePort: Number(process.env.DEVICE_PORT || 4370),
  deviceId: process.env.DEVICE_ID || "ESSL-001",
  verificationType: process.env.DEVICE_VERIFICATION_TYPE || "fingerprint",
  apiUrl: process.env.API_URL,
  secret: process.env.BIOMETRIC_API_SECRET,
  tzOffsetMinutes: Number(process.env.TZ_OFFSET_MINUTES || 330),
  lookbackDays: Number(process.env.LOOKBACK_DAYS || 1),
  pollIntervalSeconds: Number(process.env.POLL_INTERVAL_SECONDS || 300)
};

// --test and --listen only need to reach the device; full sync also needs app config.
const CLI_ARGS = process.argv.slice(2);
const DEVICE_ONLY = CLI_ARGS.includes("--test") || CLI_ARGS.includes("--listen");
const REQUIRED = DEVICE_ONLY
  ? [["deviceIp", "DEVICE_IP"]]
  : [["deviceIp", "DEVICE_IP"], ["apiUrl", "API_URL"], ["secret", "BIOMETRIC_API_SECRET"]];
for (const [key, label] of REQUIRED) {
  if (!CFG[key]) {
    console.error(`Config error: ${label} is not set in .env`);
    process.exit(1);
  }
}

// ---------- time helpers ----------
// node-zklib returns each punch as the device's wall-clock time. We assume this
// PC's clock is in the same timezone as the device (e.g. IST) and stamp the
// configured offset onto the ISO string so the server interprets the day correctly.
function pad(n) {
  return String(n).padStart(2, "0");
}
function offsetSuffix(mins) {
  const sign = mins >= 0 ? "+" : "-";
  const abs = Math.abs(mins);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
function toIso(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    offsetSuffix(CFG.tzOffsetMinutes)
  );
}
function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ---------- de-dupe state (so we never re-post the same punch) ----------
function loadState() {
  if (!existsSync(STATE_FILE)) return { posted: {} };
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { posted: {} };
  }
}
function saveState(state) {
  // Prune keys older than 30 days so the file stays small.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const [key, ts] of Object.entries(state.posted)) {
    if (ts < cutoff) delete state.posted[key];
  }
  writeFileSync(STATE_FILE, JSON.stringify(state));
}

// ---------- device read ----------
async function readPunches() {
  const zk = new ZKLib(CFG.deviceIp, CFG.devicePort, 15000, 5000);
  await zk.createSocket();
  try {
    // node-zklib hangs and crashes when the device has zero stored punches, so
    // ask for the count first and skip the read when there's nothing to fetch.
    const info = await zk.getInfo().catch(() => null);
    if (info && Number(info.logCounts) === 0) return [];
    const result = await zk.getAttendances();
    return Array.isArray(result?.data) ? result.data : [];
  } finally {
    try {
      await zk.disconnect();
    } catch {
      /* ignore */
    }
  }
}

// Turn raw device rows into normalized punches within the lookback window.
function normalize(rawRows) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - CFG.lookbackDays + 1);
  cutoff.setHours(0, 0, 0, 0);

  const punches = [];
  for (const row of rawRows) {
    const userId = String(row.deviceUserId ?? row.userId ?? row.uid ?? "").trim();
    const when = new Date(row.recordTime ?? row.timestamp ?? row.time);
    if (!userId || Number.isNaN(when.getTime()) || when < cutoff) continue;
    punches.push({ userId, when, dateKey: toDateKey(when) });
  }
  return punches;
}

// First punch of a user's day = check-in, last punch = check-out.
// This matches the app's merge logic (earliest check-in, latest check-out).
function deriveEvents(punches) {
  const byUserDay = new Map();
  for (const p of punches) {
    const key = `${p.userId}|${p.dateKey}`;
    const group = byUserDay.get(key) ?? [];
    group.push(p);
    byUserDay.set(key, group);
  }

  const events = [];
  for (const group of byUserDay.values()) {
    group.sort((a, b) => a.when - b.when);
    const first = group[0];
    const last = group[group.length - 1];
    events.push({ ...first, eventType: "checkin" });
    if (last.when.getTime() !== first.when.getTime()) {
      events.push({ ...last, eventType: "checkout" });
    }
  }
  return events;
}

async function postEvent(event) {
  const body = {
    deviceId: CFG.deviceId,
    biometricUserId: event.userId,
    timestamp: toIso(event.when),
    verificationType: CFG.verificationType,
    eventType: event.eventType
  };
  const res = await fetch(CFG.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-biometric-secret": CFG.secret },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.ok !== false, status: res.status, data, body };
}

async function syncOnce() {
  const stamp = new Date().toLocaleString();
  let rawRows;
  try {
    rawRows = await readPunches();
  } catch (err) {
    console.error(`[${stamp}] Could not reach device at ${CFG.deviceIp}:${CFG.devicePort} — ${err.message}`);
    return;
  }

  const events = deriveEvents(normalize(rawRows));
  const state = loadState();
  let posted = 0;
  let skipped = 0;
  let failed = 0;

  for (const event of events) {
    const key = `${event.userId}|${toIso(event.when)}|${event.eventType}`;
    if (state.posted[key]) {
      skipped++;
      continue;
    }
    const result = await postEvent(event);
    if (result.ok) {
      state.posted[key] = Date.now();
      posted++;
      const note = result.data.attendanceDocumentId ? "" : " (no teacher matched this biometric ID)";
      console.log(`[${stamp}] ${event.eventType} user=${event.userId} @ ${toIso(event.when)}${note}`);
    } else {
      failed++;
      console.error(`[${stamp}] FAILED ${event.eventType} user=${event.userId} -> HTTP ${result.status} ${JSON.stringify(result.data)}`);
    }
  }

  saveState(state);
  console.log(`[${stamp}] Done. raw=${rawRows.length} events=${events.length} posted=${posted} skipped=${skipped} failed=${failed}`);
}

// True only when API_URL / secret are real (not the .env.example placeholders).
function canForward() {
  return Boolean(CFG.apiUrl && CFG.secret && !/your-app|change_this_secret/.test(`${CFG.apiUrl}|${CFG.secret}`));
}

// Watch the device and react to each punch the instant it happens.
async function listen() {
  const forward = canForward();
  console.log(`Listening for live punches from ${CFG.deviceIp} ... (press Ctrl+C to stop)`);
  console.log(forward ? `Punches will be forwarded to ${CFG.apiUrl}` : "API_URL/secret not set yet — punches will only be printed here.");

  const zk = new ZKLib(CFG.deviceIp, CFG.devicePort, 0, 5000);
  await zk.createSocket();
  process.on("SIGINT", async () => {
    try {
      await zk.disconnect();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });

  const state = loadState();
  const seenToday = new Set();

  await zk.getRealTimeLogs(async (log) => {
    const userId = String(log?.userId ?? "").trim();
    if (!userId) return;
    const parsed = log?.attTime ? new Date(log.attTime) : new Date();
    const when = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const dayKey = `${userId}|${toDateKey(when)}`;
    const eventType = seenToday.has(dayKey) ? "checkout" : "checkin";
    seenToday.add(dayKey);
    const iso = toIso(when);
    console.log(`PUNCH  user=${userId} @ ${iso}  -> ${eventType}`);

    if (!forward) return;
    const dedupeKey = `${userId}|${iso}|${eventType}`;
    if (state.posted[dedupeKey]) return;
    const result = await postEvent({ userId, when, eventType });
    if (result.ok) {
      state.posted[dedupeKey] = Date.now();
      saveState(state);
      console.log(`   forwarded -> ${result.data.attendanceDocumentId ? "attendance marked ✓" : "no teacher matched this biometric ID"}`);
    } else {
      console.log(`   forward FAILED -> HTTP ${result.status} ${JSON.stringify(result.data)}`);
    }
  });

  process.stdin.resume(); // keep the process alive while listening
}

async function testConnection() {
  console.log(`Connecting to ${CFG.deviceIp}:${CFG.devicePort} ...`);
  const zk = new ZKLib(CFG.deviceIp, CFG.devicePort, 15000, 5000);
  await zk.createSocket();
  try {
    const info = await zk.getInfo().catch(() => null);
    if (info) {
      console.log(`Connected ✓  enrolled users: ${info.userCounts}, stored punches: ${info.logCounts}, capacity: ${info.logCapacity}`);
    } else {
      console.log("Connected, but could not read device info.");
    }
    if (info && Number(info.logCounts) > 0) {
      const result = await zk.getAttendances();
      const rows = Array.isArray(result?.data) ? result.data : [];
      console.log("Latest punches on the device:");
      for (const row of rows.slice(-5)) console.log("  ", JSON.stringify(row));
    } else {
      console.log("No punches stored yet. Enroll users on the device and punch once, then re-run.");
    }
  } finally {
    try {
      await zk.disconnect();
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--test")) {
    await testConnection().catch((err) => {
      console.error("Connection test failed:", err.message);
      process.exit(1);
    });
    return;
  }

  if (args.includes("--listen")) {
    await listen();
    return;
  }

  if (args.includes("--loop")) {
    console.log(`Polling every ${CFG.pollIntervalSeconds}s. Press Ctrl+C to stop.`);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await syncOnce();
      await new Promise((r) => setTimeout(r, CFG.pollIntervalSeconds * 1000));
    }
  }

  await syncOnce();
}

main();
