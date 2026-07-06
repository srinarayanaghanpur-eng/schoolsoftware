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

function copyRuntimeEnvFiles(destDir) {
  for (const fileName of RUNTIME_ENV_FILES) {
    const src = path.join(WEB_DIR, fileName);
    const dest = path.join(destDir, fileName);

    if (!fs.existsSync(src)) continue;

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
    log(`Copied runtime environment file: ${fileName}`);
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

  log("Copying runtime environment files...");
  copyRuntimeEnvFiles(path.join(resourcesWebDir, "apps", "web"));

  assertExists(path.join(resourcesWebDir, "apps", "web", "server.js"), "Standalone server");
  assertExists(path.join(resourcesWebDir, "apps", "web", ".next", "static"), "Next.js static assets");

  log("Build complete! Desktop resources in apps/desktop/resources/");
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
}

main();
