const { contextBridge, ipcRenderer } = require("electron");

const versions = {
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node,
};

const narayana = {
  isDesktop: true,
  platform: process.platform,
  versions,
  app: {
    info: () => ipcRenderer.invoke("app:info"),
    capabilities: () => ipcRenderer.invoke("app:capabilities"),
  },
  print: {
    current: (options) => ipcRenderer.invoke("print:current", options),
    pdf: (options) => ipcRenderer.invoke("print:pdf", options),
  },
  notify: {
    show: (options) => ipcRenderer.invoke("notify:show", options),
    onNavigate: (callback) => {
      const listener = (_event, route) => callback(route);
      ipcRenderer.on("notify:navigate", listener);
      return () => ipcRenderer.removeListener("notify:navigate", listener);
    },
  },
};

contextBridge.exposeInMainWorld("narayana", narayana);

// Deprecated alias kept until no code depends on it.
contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => "1.0.0",
  isDesktop: true,
  platform: process.platform,
  versions,
});
