const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DESKTOP_DIR = path.resolve(__dirname, "..");
const ROOT = path.resolve(DESKTOP_DIR, "..", "..");
const OUT_DIR = path.join(DESKTOP_DIR, "dist");
const portable = process.argv.includes("--portable");
const skipWeb = process.argv.includes("--skip-web");

function log(message) {
  console.log(`[installer] ${message}`);
}

function stageApp(stageDir) {
  for (const name of ["package.json", "main.js", "preload.js"]) {
    fs.copyFileSync(path.join(DESKTOP_DIR, name), path.join(stageDir, name));
  }
  fs.cpSync(path.join(DESKTOP_DIR, "assets"), path.join(stageDir, "assets"), {
    recursive: true,
  });
  fs.cpSync(path.join(DESKTOP_DIR, "resources"), path.join(stageDir, "resources"), {
    recursive: true,
  });
}

function copyArtifacts(stageDir) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const builtDist = path.join(stageDir, "dist");
  for (const entry of fs.readdirSync(builtDist)) {
    if (!entry.endsWith(".exe") && !entry.endsWith(".blockmap")) continue;
    fs.copyFileSync(path.join(builtDist, entry), path.join(OUT_DIR, entry));
    log(`Copied ${entry}`);
  }
}

function main() {
  if (skipWeb) {
    const serverScript = path.join(DESKTOP_DIR, "resources", "apps", "web", "server.js");
    if (!fs.existsSync(serverScript)) {
      throw new Error("No built web resources found. Run npm run build:desktop first.");
    }
    log("Reusing existing web resources (--skip-web).");
  } else {
    log("Building web resources...");
    execFileSync(process.execPath, [path.join(DESKTOP_DIR, "scripts", "build-web.js")], {
      cwd: DESKTOP_DIR,
      stdio: "inherit",
    });
  }

  const stageDir = fs.mkdtempSync(path.join(os.tmpdir(), "sri-narayana-erp-"));
  try {
    stageApp(stageDir);

    const cli = require.resolve("electron-builder/cli.js");
    const args = [
      cli,
      ...(portable ? ["--win", "portable"] : ["--win"]),
      "--projectDir",
      stageDir,
    ];

    log(`Building ${portable ? "portable" : "NSIS"} installer outside the workspace...`);
    const result = spawnSync(process.execPath, args, {
      cwd: ROOT,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`electron-builder exited with code ${result.status}`);
    }

    copyArtifacts(stageDir);
    log(`Installer artifacts are in ${OUT_DIR}`);
  } finally {
    fs.rmSync(stageDir, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 500,
    });
  }
}

main();
