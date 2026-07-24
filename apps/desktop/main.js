const { app, BrowserWindow, dialog, shell } = require("electron");
const { fork } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const DEFAULT_PORT = Number(process.env.ERP_PORT || 3456);
const HOST = "127.0.0.1";
const PORT_SCAN_LIMIT = 50;

let isQuitting = false;
let mainWindow = null;
let serverPort = DEFAULT_PORT;
let serverProcess = null;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.setName("Sri Narayana ERP");
if (process.platform === "win32") {
  app.setAppUserModelId("com.sri-narayana.high-school.erp");
}

function getServerScript() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "web", "apps", "web", "server.js");
  }

  return path.join(__dirname, "..", "web", ".next", "standalone", "apps", "web", "server.js");
}

function getWebRoot() {
  return path.dirname(getServerScript());
}

function getIconPath() {
  const candidates = [
    path.join(__dirname, "assets", "icon.ico"),
    path.join(getWebRoot(), "public", "sri-narayana-high-school-logo.jpg"),
    path.join(__dirname, "..", "web", "public", "sri-narayana-high-school-logo.jpg"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function parseEnvValue(value) {
  let parsed = value.trim();
  const quote = parsed[0];

  if ((quote === "\"" || quote === "'" || quote === "`") && parsed.endsWith(quote)) {
    parsed = parsed.slice(1, -1);
  }

  return quote === "\"" ? parsed.replace(/\\n/g, "\n") : parsed;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const normalizedLine = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const equalsIndex = normalizedLine.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = normalizedLine.slice(0, equalsIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    process.env[key] = parseEnvValue(normalizedLine.slice(equalsIndex + 1));
  }

  return true;
}

function loadRuntimeEnvironment() {
  const webRoot = getWebRoot();
  const envCandidates = [
    path.join(__dirname, "..", "web", ".env.local"),
    path.join(__dirname, "..", "web", ".env.production"),
    path.join(__dirname, "..", "web", ".env"),
    path.join(webRoot, ".env.local"),
    path.join(webRoot, ".env.production"),
    path.join(webRoot, ".env"),
  ];

  for (const envFile of Array.from(new Set(envCandidates))) {
    if (loadEnvFile(envFile)) {
      console.log(`[desktop] Loaded runtime environment from ${envFile}`);
    }
  }
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, HOST);
  });
}

async function findAvailablePort(preferredPort) {
  for (let offset = 0; offset < PORT_SCAN_LIMIT; offset += 1) {
    const port = preferredPort + offset;
    if (await isPortAvailable(port)) return port;
  }

  throw new Error(`No available local port found between ${preferredPort} and ${preferredPort + PORT_SCAN_LIMIT - 1}`);
}

function waitForPort(port, host, timeout = 45000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();

    function check() {
      const sock = new net.Socket();
      sock.setTimeout(1000);

      sock.on("connect", () => {
        sock.destroy();
        resolve();
      });

      sock.on("timeout", () => {
        sock.destroy();
        retry();
      });

      sock.on("error", () => {
        sock.destroy();
        retry();
      });

      function retry() {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for ERP server on ${host}:${port}`));
        } else {
          setTimeout(check, 300);
        }
      }

      sock.connect(port, host);
    }

    check();
  });
}

function stopServer() {
  if (!serverProcess) return;

  serverProcess.kill();
  serverProcess = null;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function loadErrorPage(title, message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${safeTitle}</title>
        <style>
          body {
            align-items: center;
            background: #0f172a;
            color: #f8fafc;
            display: flex;
            font-family: Arial, sans-serif;
            justify-content: center;
            margin: 0;
            min-height: 100vh;
          }
          main {
            max-width: 620px;
            padding: 32px;
          }
          h1 {
            font-size: 24px;
            margin: 0 0 12px;
          }
          p {
            color: #cbd5e1;
            line-height: 1.6;
            margin: 0;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <main>
          <h1>${safeTitle}</h1>
          <p>${safeMessage}</p>
        </main>
      </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function loadSplashPage(message = "Starting secure ERP workspace...") {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const safeMessage = escapeHtml(message);
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Sri Narayana ERP</title>
        <style>
          body {
            align-items: center;
            background: linear-gradient(135deg, #17217f 0%, #0f172a 100%);
            color: #f8fafc;
            display: flex;
            font-family: Arial, sans-serif;
            justify-content: center;
            margin: 0;
            min-height: 100vh;
          }
          main {
            text-align: center;
          }
          .logo {
            align-items: center;
            background: #fff;
            border-radius: 18px;
            color: #17217f;
            display: inline-flex;
            font-size: 24px;
            font-weight: 900;
            height: 72px;
            justify-content: center;
            margin-bottom: 22px;
            width: 72px;
          }
          h1 {
            font-size: 24px;
            letter-spacing: 0.02em;
            margin: 0;
          }
          p {
            color: #cbd5e1;
            font-size: 14px;
            font-weight: 700;
            margin: 10px 0 0;
          }
          .spinner {
            animation: spin 0.9s linear infinite;
            border: 3px solid rgb(255 255 255 / 0.22);
            border-top-color: #facc15;
            border-radius: 999px;
            height: 28px;
            margin: 24px auto 0;
            width: 28px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <main>
          <div class="logo">SN</div>
          <h1>Sri Narayana ERP</h1>
          <p>${safeMessage}</p>
          <div class="spinner" aria-hidden="true"></div>
        </main>
      </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

async function startServer() {
  const serverScript = getServerScript();

  if (!fs.existsSync(serverScript)) {
    const message = [
      "The web app server was not found.",
      "",
      "Run: npm run build:desktop",
      "",
      `Expected: ${serverScript}`,
    ].join("\n");

    dialog.showErrorBox("ERP Server Not Built", message);
    throw new Error(`Server script not found: ${serverScript}`);
  }

  loadRuntimeEnvironment();
  serverPort = await findAvailablePort(DEFAULT_PORT);

  const env = {
    ...process.env,
    HOSTNAME: HOST,
    NODE_ENV: "production",
    PORT: String(serverPort),
  };

  serverProcess = fork(serverScript, [], {
    env,
    execArgv: ["--max-old-space-size=2048"],
    stdio: ["pipe", "pipe", "pipe", "ipc"],
  });

  serverProcess.stdout.on("data", (data) => {
    console.log(`[Next.js] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[Next.js] ${data.toString().trim()}`);
  });

  serverProcess.on("exit", (code) => {
    console.log(`[Next.js] ERP server exited with code ${code}`);
    serverProcess = null;

    if (!isQuitting) {
      loadErrorPage("ERP Server Stopped", "The local ERP server stopped unexpectedly. Close and reopen the app.");
    }
  });

  await waitForPort(serverPort, HOST);
}

function createWindow() {
  const icon = getIconPath();

  mainWindow = new BrowserWindow({
    backgroundColor: "#0f172a",
    height: 900,
    icon,
    minHeight: 700,
    minWidth: 1024,
    show: false,
    title: "Sri Narayana High School ERP",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
    width: 1400,
  });

  loadSplashPage();

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    loadErrorPage("ERP Failed To Load", `${errorDescription} (${errorCode})\n\nLocal URL: http://${HOST}:${serverPort}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      const isLocalErp =
        (target.hostname === HOST || target.hostname === "localhost") &&
        Number(target.port || serverPort) === serverPort;

      if (isLocalErp) return { action: "allow" };

      shell.openExternal(url);
      return { action: "deny" };
    } catch {
      return { action: "deny" };
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    stopServer();
  });
}

function loadAppUrl() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(`http://${HOST}:${serverPort}`);
}

app.on("second-instance", () => {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  isQuitting = true;
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  stopServer();
});

app.whenReady().then(async () => {
  try {
    createWindow();
    console.log("[desktop] Starting ERP server...");
    await startServer();
    console.log(`[desktop] ERP server ready at http://${HOST}:${serverPort}`);
    loadAppUrl();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[desktop] Failed to start app:", err);
    loadErrorPage("Sri Narayana ERP Failed To Start", message);
    dialog.showErrorBox("Sri Narayana ERP Failed To Start", message);
    app.quit();
  }
});
