const { app, BrowserWindow, dialog } = require("electron");
const { fork } = require("child_process");
const path = require("path");
const net = require("net");
const fs = require("fs");

const PORT = process.env.ERP_PORT || 3456;

let serverProcess = null;
let mainWindow = null;

function getServerScript() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "web", "apps", "web", "server.js");
  }
  return path.join(__dirname, "..", "web", ".next", "standalone", "apps", "web", "server.js");
}

function waitForPort(port, host, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      const sock = new net.Socket();
      sock.setTimeout(1000);
      sock.on("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.on("error", () => {
        sock.destroy();
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for port ${port}`));
        } else {
          setTimeout(check, 300);
        }
      });
      sock.connect(port, host);
    }
    check();
  });
}

async function startServer() {
  const serverScript = getServerScript();

  if (!fs.existsSync(serverScript)) {
    dialog.showErrorBox(
      "Server Not Built",
      "The web app server was not found.\n\n" +
      "Run: npm run build:desktop\n\n" +
      `Expected: ${serverScript}`
    );
    throw new Error(`Server script not found: ${serverScript}`);
  }

  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
  };

  serverProcess = fork(serverScript, [], {
    env,
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    execArgv: ["--max-old-space-size=2048"],
  });

  serverProcess.stdout.on("data", (data) => {
    console.log(`[Next.js] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[Next.js] ${data.toString().trim()}`);
  });

  serverProcess.on("exit", (code) => {
    console.log(`[Next.js] Server exited with code ${code}`);
    serverProcess = null;
  });

  await waitForPort(PORT, "127.0.0.1");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "Sri Narayana High School ERP",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://127.0.0.1") || url.startsWith("http://localhost")) {
      return { action: "allow" };
    }
    return { action: "deny" };
  });
}

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.whenReady().then(async () => {
  try {
    console.log("Starting Next.js server...");
    await startServer();
    console.log(`Server ready at http://127.0.0.1:${PORT}`);
    createWindow();
  } catch (err) {
    console.error("Failed to start app:", err);
    app.quit();
  }
});
