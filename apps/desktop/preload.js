const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  getVersion: () => "1.0.0",
  isDesktop: true,
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
    node: process.versions.node,
  },
});
