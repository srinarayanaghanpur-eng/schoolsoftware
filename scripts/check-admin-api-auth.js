#!/usr/bin/env node
/**
 * check-admin-api-auth.js
 * -----------------------
 * Guards against the "data not saving / empty tables" class of bug.
 *
 * Every browser-side call to an `/api/admin/*` route MUST carry the Firebase
 * ID token. The approved way is the shared helper `adminApiRequest()` from
 * `lib/adminApiClient.ts`, which attaches `Authorization: Bearer <token>`.
 * A small number of files legitimately attach the token by hand; those are
 * allowed because an `authorization` header appears next to the fetch.
 *
 * This script scans client source under apps/web (app/, components/, lib/) for
 * raw `fetch("/api/admin...")` calls that do NOT attach an Authorization header
 * within a few lines. Any such call would hit the route unauthenticated and get
 * a 401 — exactly the bug we just fixed. It prints offending file:line and
 * exits non-zero so it can run in CI / pre-commit.
 *
 * Usage:  node scripts/check-admin-api-auth.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "apps", "web");
// Where client code lives. We deliberately skip `public/` (service workers
// queue requests and attach tokens via IndexedDB, not getIdToken()).
const SCAN_DIRS = ["app", "components", "lib"];
const EXT = new Set([".ts", ".tsx", ".js", ".jsx"]);
// How many lines after the fetch( line to look for an Authorization header.
const LOOKAHEAD = 4;

/** Recursively collect source files under a directory. */
function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      collectFiles(full, out);
    } else if (EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];

for (const sub of SCAN_DIRS) {
  const files = collectFiles(path.join(ROOT, sub));
  for (const file of files) {
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // A fetch call targeting an /api/admin route (any quote style).
      const isAdminFetch = /fetch\s*\(\s*[`"']\/api\/admin/.test(line);
      if (!isAdminFetch) continue;

      // Look at this line + a few following for an Authorization header.
      const windowText = lines.slice(i, i + 1 + LOOKAHEAD).join("\n");
      const hasAuth = /authorization/i.test(windowText);
      if (!hasAuth) {
        offenders.push(`${path.relative(path.resolve(__dirname, ".."), file)}:${i + 1}`);
      }
    }
  }
}

if (offenders.length > 0) {
  console.error(
    "\n✖ Unauthenticated /api/admin fetch calls found.\n" +
      "  Use adminApiRequest() from lib/adminApiClient.ts, or attach an\n" +
      "  Authorization: Bearer <token> header. Offending locations:\n"
  );
  for (const o of offenders) console.error("   - " + o);
  console.error("");
  process.exit(1);
}

console.log("✓ No unauthenticated /api/admin fetch calls found.");
