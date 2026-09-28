import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".expo",
  ".playwright-cli",
  "dist",
  "build",
  "out",
  "coverage",
  "__mobile"
]);
const TEST_SUFFIXES = [".test.ts", ".test.tsx", ".test.mjs", ".test.js"];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (TEST_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(process.cwd()).sort();
if (files.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}
console.log(`Running ${files.length} test file(s) with node:test...`);
const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit"
});
process.exit(result.status ?? 1);
