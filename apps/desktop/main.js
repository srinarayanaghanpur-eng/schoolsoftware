const { app, BrowserWindow, dialog, ipcMain, Menu, Notification, safeStorage, session, shell } = require("electron");
const { fork } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");
const { pathToFileURL } = require("url");
const { AgentService } = require("./messaging/agentService");

const DEFAULT_PORT = Number(process.env.ERP_PORT || 3456);
const HOST = "127.0.0.1";
const PORT_SCAN_LIMIT = 50;
// Hosted-first mode: packaged builds load the deployed web app by default so
// office PCs never need the Firebase Admin service-account key. Set
// ERP_APP_URL to override the URL, or ERP_APP_URL=local to force the bundled
// local Next.js server (development / offline fallback).
const DEFAULT_HOSTED_URL = "https://schoolsoftware-two.vercel.app";
const ENV_APP_URL = String(process.env.ERP_APP_URL || "").trim();
const REMOTE_APP_URL =
  ENV_APP_URL === "local" ? "" : ENV_APP_URL || (app.isPackaged ? DEFAULT_HOSTED_URL : "");
const USE_REMOTE_APP = Boolean(REMOTE_APP_URL);

let isQuitting = false;
let mainWindow = null;
let serverPort = DEFAULT_PORT;
let serverProcess = null;
let agentWindow = null;
let messagingService = null;
let capturedBearerToken = "";
let capturedBearerAt = 0;
let tokenCaptureOrigin = "";

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

app.setName("Sri Narayana ERP");
if (process.platform === "win32") {
  app.setAppUserModelId("com.sri-narayana.high-school.erp");
}

function getAppOrigin() {
  if (!USE_REMOTE_APP) return "";
  try {
    return new URL(REMOTE_APP_URL).origin;
  } catch {
    return "";
  }
}

function isAllowedAppUrl(url) {
  try {
    const target = new URL(url);
    if (USE_REMOTE_APP) return target.origin === getAppOrigin();
    return (
      (target.hostname === HOST || target.hostname === "localhost") &&
      Number(target.port || serverPort) === serverPort
    );
  } catch {
    return false;
  }
}

function getAppUrl() {
  return USE_REMOTE_APP ? REMOTE_APP_URL : `http://${HOST}:${serverPort}`;
}

function isTrustedSender(event) {
  const url = event.senderFrame?.url || event.sender.getURL();
  return isAllowedAppUrl(url);
}

function getServerScript() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "web", "apps", "web", "server.js");
  }

  // Dev/unpackaged runs use the fully assembled resources folder, which
  // includes .next/static and public assets. The raw .next/standalone output
  // does not contain those files, so serving from it leaves the UI unstyled.
  return path.join(__dirname, "resources", "apps", "web", "server.js");
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
  const userDataDir = (() => {
    try {
      return app.getPath("userData");
    } catch {
      return null;
    }
  })();

  const envCandidates = [
    // Dev checkout: apps/web/.env*
    path.join(__dirname, "..", "web", ".env.local"),
    path.join(__dirname, "..", "web", ".env.production"),
    path.join(__dirname, "..", "web", ".env"),
    // Legacy packaged installs (current builds no longer package env files —
    // they contain the Firebase service-account key; see build-web.js).
    path.join(webRoot, ".env.local"),
    path.join(webRoot, ".env.production"),
    path.join(webRoot, ".env"),
    // Packaged secure location: per-user application-data folder.
    // Provisioning: copy the school's .env.local into this folder.
    ...(userDataDir
      ? [
          path.join(userDataDir, ".env.local"),
          path.join(userDataDir, ".env.production"),
          path.join(userDataDir, ".env"),
        ]
      : []),
  ];

  for (const envFile of Array.from(new Set(envCandidates))) {
    if (loadEnvFile(envFile)) {
      console.log(`[desktop] Loaded runtime environment from ${envFile}`);
    }
  }

  const hasFirebaseCreds =
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) ||
    Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    (Boolean(process.env.FIREBASE_CLIENT_EMAIL) && Boolean(process.env.FIREBASE_PRIVATE_KEY));

  if (!hasFirebaseCreds) {
    const target = userDataDir ? path.join(userDataDir, ".env.local") : "<app-data>/.env.local";
    const message = [
      "Firebase credentials were not found.",
      "",
      "The ERP server cannot access school data without them.",
      "",
      "Copy the school's .env.local file to:",
      target,
    ].join("\n");
    console.warn(`[desktop] WARNING: ${message}`);
    if (app.isPackaged) {
      dialog.showErrorBox("Configuration Required", message);
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
    autoHideMenuBar: true,
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

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame === false) return;
    if (errorCode === -3 || String(validatedURL || "").startsWith("data:")) return;
    loadErrorPage("ERP Failed To Load", `${errorDescription} (${errorCode})\n\nApp URL: ${getAppUrl()}`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url)) return { action: "allow" };
    void shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedAppUrl(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (agentWindow && !agentWindow.isDestroyed()) agentWindow.close();
    stopServer();
  });
}

function loadAppUrl() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(getAppUrl());
}

function getErpOrigin() {
  if (USE_REMOTE_APP) return getAppOrigin();
  if (!serverPort) return "";
  return `http://${HOST}:${serverPort}`;
}

function installTokenCapture(origin) {
  if (!origin) return;
  if (tokenCaptureOrigin === origin) return;
  tokenCaptureOrigin = origin;

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: [`${origin}/api/*`] },
    (details, callback) => {
      const headers = details.requestHeaders || {};
      const raw = headers.Authorization || headers.authorization;
      const auth = Array.isArray(raw) ? raw[0] : raw;
      if (typeof auth === "string" && auth.startsWith("Bearer ")) {
        capturedBearerToken = auth.slice("Bearer ".length);
        capturedBearerAt = Date.now();
      }
      callback({ requestHeaders: headers });
    }
  );
}

function currentErpToken() {
  if (!capturedBearerToken) return "";
  // ERP ID tokens are valid for about one hour. Force a refresh by asking the
  // operator to interact with the ERP after 55 minutes instead of sending a
  // token that will fail with 401.
  if (Date.now() - capturedBearerAt > 55 * 60 * 1000) return "";
  return capturedBearerToken;
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function isTrustedAgentSender(event) {
  if (!agentWindow || agentWindow.isDestroyed()) return false;
  if (event.sender !== agentWindow.webContents) return false;
  const expected = pathToFileURL(path.join(__dirname, "agent", "agent.html")).href;
  const url = event.senderFrame?.url || event.sender.getURL();
  return String(url).startsWith(expected);
}

function openMessagingAgent() {
  if (agentWindow && !agentWindow.isDestroyed()) {
    if (agentWindow.isMinimized()) agentWindow.restore();
    agentWindow.show();
    agentWindow.focus();
    return;
  }

  agentWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 960,
    minHeight: 680,
    title: "Sri Narayana ERP - Bulk SMS Agent",
    backgroundColor: "#0f172a",
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "agent-preload.js")
    }
  });

  agentWindow.once("ready-to-show", () => {
    agentWindow.show();
    agentWindow.focus();
  });

  agentWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  agentWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  agentWindow.loadFile(path.join(__dirname, "agent", "agent.html")).catch((error) => {
    dialog.showErrorBox("Messaging Agent", error instanceof Error ? error.message : String(error));
  });
  agentWindow.on("closed", () => {
    agentWindow = null;
  });
}

function registerMessagingIpc() {
  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (event, payload) => {
      if (!isTrustedAgentSender(event)) {
        return { ok: false, code: "UNTRUSTED", error: "Untrusted sender" };
      }
      if (!messagingService) {
        return { ok: false, code: "NOT_READY", error: "Messaging service is not ready" };
      }
      try {
        return { ok: true, data: await handler(payload) };
      } catch (error) {
        return {
          ok: false,
          code: error?.code || "AGENT_ERROR",
          error: error instanceof Error ? error.message : "Messaging agent failed"
        };
      }
    });
  };

  handle("agent:bootstrap", () => messagingService.bootstrap());
  handle("agent:open-erp", () => {
    focusMainWindow();
    return true;
  });
  handle("agent:academic-years", () => messagingService.academicYears());
  handle("agent:students", (payload) => messagingService.students(payload));
  handle("agent:save-settings", (payload) => {
    const body = payload && typeof payload === "object" ? payload : {};
    return messagingService.saveSettings(body.settings, body.authToken);
  });
  handle("agent:clear-token", () => messagingService.clearAuthToken());
  handle("agent:test-gateway", (payload) => messagingService.testGateway(payload || {}));
  handle("agent:create-campaign", (payload) => messagingService.createCampaign(payload));
  handle("agent:start-campaign", (payload) => messagingService.start(payload));
  handle("agent:pause-campaign", (payload) => messagingService.pause(payload));
  handle("agent:resume-campaign", (payload) => messagingService.resume(payload));
  handle("agent:retry-failed", (payload) => messagingService.retryFailed(payload));
  handle("agent:state", (payload) => messagingService.state(payload));
  handle("agent:export-campaign", (payload) => messagingService.exportCampaign(payload));
}

function installApplicationMenu() {
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }]
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Bulk Messaging Agent",
          accelerator: "CmdOrCtrl+Shift+M",
          click: () => openMessagingAgent()
        },
        {
          label: "Open ERP",
          click: () => focusMainWindow()
        }
      ]
    },
    {
      label: "View",
      submenu: [{ role: "reload" }, { role: "toggleDevTools" }]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function registerIpcHandlers() {
  ipcMain.handle("app:info", (event) => {
    if (!isTrustedSender(event)) return null;
    return {
      version: app.getVersion(),
      platform: process.platform,
      isPackaged: app.isPackaged,
      mode: USE_REMOTE_APP ? "hosted" : "local",
    };
  });

  ipcMain.handle("app:capabilities", (event) => {
    if (!isTrustedSender(event)) return null;
    return {
      nativePrint: true,
      pdfExport: true,
      offlineAttendance: false,
      biometric: false,
      updater: false,
      hostedMode: USE_REMOTE_APP,
    };
  });

  ipcMain.handle("notify:show", (event, options = {}) => {
    if (!isTrustedSender(event)) return { ok: false, error: "Untrusted sender" };
    if (!Notification.isSupported()) return { ok: false, error: "Notifications are not supported" };

    const title = String(options?.title || "Sri Narayana ERP").slice(0, 120);
    const body = String(options?.body || "").slice(0, 500);
    const route = typeof options?.route === "string" && options.route.startsWith("/") ? options.route : "";

    const notification = new Notification({
      title,
      body,
      icon: getIconPath(),
      silent: false,
    });

    notification.on("click", () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      if (route) mainWindow.webContents.send("notify:navigate", route);
    });

    notification.show();
    return { ok: true };
  });

  ipcMain.handle("print:current", async (event) => {
    if (!isTrustedSender(event)) return { ok: false, error: "Untrusted sender" };
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false, error: "No window" };
    return new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        resolve(success ? { ok: true } : { ok: false, error: failureReason || "Print canceled" });
      });
    });
  });

  ipcMain.handle("print:pdf", async (event, options = {}) => {
    if (!isTrustedSender(event)) return { ok: false, error: "Untrusted sender" };
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false, error: "No window" };

    const rawName = String(options?.defaultName || "document.pdf");
    const defaultName =
      rawName.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120) || "document.pdf";
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };

    try {
      const data = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
      });
      fs.writeFileSync(filePath, data);
      return { ok: true, path: filePath };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to save PDF",
      };
    }
  });
}

app.on("second-instance", () => {
  if (!mainWindow) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.on("window-all-closed", () => {
  isQuitting = true;
  messagingService?.stopAll();
  stopServer();
  app.quit();
});

app.on("before-quit", () => {
  isQuitting = true;
  messagingService?.stopAll();
  stopServer();
});

app.whenReady().then(async () => {
  try {
    installApplicationMenu();
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
      if (permission !== "notifications") {
        callback(true);
        return;
      }
      const url = details?.requestingUrl || webContents.getURL();
      callback(isAllowedAppUrl(url));
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (permission !== "notifications") return true;
      return isAllowedAppUrl(requestingOrigin || webContents.getURL());
    });
    registerIpcHandlers();
    createWindow();

    try {
      messagingService = new AgentService({
        userDataDir: app.getPath("userData"),
        safeStorage,
        getOrigin: getErpOrigin,
        getToken: currentErpToken,
        focusErp: focusMainWindow
      });
      messagingService.init();
      registerMessagingIpc();
    } catch (error) {
      console.error("[desktop] Messaging agent failed to initialize:", error);
      messagingService = null;
    }

    if (USE_REMOTE_APP) {
      console.log(`[desktop] Hosted mode: ${REMOTE_APP_URL}`);
      installTokenCapture(getErpOrigin());
      loadAppUrl();
      return;
    }

    console.log("[desktop] Starting ERP server...");
    await startServer();
    console.log(`[desktop] ERP server ready at http://${HOST}:${serverPort}`);
    installTokenCapture(getErpOrigin());
    loadAppUrl();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[desktop] Failed to start app:", err);
    loadErrorPage("Sri Narayana ERP Failed To Start", message);
    dialog.showErrorBox("Sri Narayana ERP Failed To Start", message);
    app.quit();
  }
});



