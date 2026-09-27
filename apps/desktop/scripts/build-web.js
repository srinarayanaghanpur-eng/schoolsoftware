const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const WEB_DIR = path.join(ROOT, "apps", "web");
const DESKTOP_DIR = path.join(ROOT, "apps", "desktop");
const RESOURCES_DIR = path.join(DESKTOP_DIR, "resources");
const NEXT_DIR = path.join(WEB_DIR, ".next");
const STANDALONE_DIR = path.join(WEB_DIR, ".next", "standalone");
const STATIC_DIR = path.join(WEB_DIR, ".next", "static");
const PUBLIC_DIR = path.join(WEB_DIR, "public");
const RUNTIME_ENV_FILES = [".env.local", ".env.production", ".env"];

function log(msg) {
  console.log(`[build-web] ${msg}`);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    log(`WARN: Source does not exist: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function removeDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, {
    force: true,
    maxRetries: 5,
    recursive: true,
    retryDelay: 500,
  });
}

// SECURITY: .env files hold the Firebase service-account private key. They must
// NEVER end up inside the distributed installer — anyone with the installer
// could extract full-privilege Firebase credentials. Packaged installs receive
// their runtime env via the per-user app-data folder (see main.js).
function assertNoSecretEnvFiles(dir) {
  const violations = [];
  const walk = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
      } else if (RUNTIME_ENV_FILES.includes(entry.name)) {
        violations.push(entryPath);
      }
    }
  };
  walk(dir);
  if (violations.length > 0) {
    throw new Error(
      "SECURITY: refusing to package secret environment files:\n" +
        violations.map((p) => `  - ${p}`).join("\n")
    );
  }
}

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} was not generated: ${filePath}`);
  }
}

function main() {
  log("Building web app with standalone output...");

  removeDirectory(RESOURCES_DIR);
  removeDirectory(NEXT_DIR);

  run("npm run build:web", {
    cwd: ROOT,
    env: { ...process.env, STANDALONE: "true" },
  });

  const resourcesWebDir = path.join(RESOURCES_DIR);

  log("Copying standalone server to resources/...");
  copyRecursive(STANDALONE_DIR, resourcesWebDir);

  log("Copying static files...");
  const staticDest = path.join(
    resourcesWebDir, "apps", "web", ".next", "static"
  );
  copyRecursive(STATIC_DIR, staticDest);

  log("Copying public assets...");
  const publicDest = path.join(resourcesWebDir, "apps", "web", "public");
  copyRecursive(PUBLIC_DIR, publicDest);

  log("Verifying that no secret environment files are packaged...");
  assertNoSecretEnvFiles(RESOURCES_DIR);

  assertExists(path.join(resourcesWebDir, "apps", "web", "server.js"), "Standalone server");
  assertExists(path.join(resourcesWebDir, "apps", "web", ".next", "static"), "Next.js static assets");

  log("Build complete! Desktop resources in apps/desktop/resources/");
  log("NOTE: runtime env is NOT packaged. Provision it at %APPDATA%/Sri Narayana ERP/.env.local on the target machine.");
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

main();
