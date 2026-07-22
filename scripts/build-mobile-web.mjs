import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const mobileRoot = path.join(repositoryRoot, "apps", "mobile");
const outputRoot = path.join(repositoryRoot, "apps", "web", "public", "__mobile");
const expoCli = require.resolve("@expo/cli/build/bin/cli");

const firebaseKeys = [
  "API_KEY",
  "AUTH_DOMAIN",
  "PROJECT_ID",
  "STORAGE_BUCKET",
  "MESSAGING_SENDER_ID",
  "APP_ID"
];

const buildEnvironment = { ...process.env };
for (const suffix of firebaseKeys) {
  const expoKey = `EXPO_PUBLIC_FIREBASE_${suffix}`;
  const nextKey = `NEXT_PUBLIC_FIREBASE_${suffix}`;
  buildEnvironment[expoKey] ||= buildEnvironment[nextKey];
}

const result = spawnSync(
  process.execPath,
  [expoCli, "export", "--platform", "web", "--output-dir", outputRoot, "--clear"],
  {
    cwd: mobileRoot,
    env: buildEnvironment,
    stdio: "inherit"
  }
);

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

await import("./prepare-mobile-web.mjs");
