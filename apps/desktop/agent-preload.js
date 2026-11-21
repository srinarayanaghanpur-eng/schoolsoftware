const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld("agent", {
  bootstrap: () => invoke("agent:bootstrap"),
  openErp: () => invoke("agent:open-erp"),
  academicYears: () => invoke("agent:academic-years"),
  students: (filters) => invoke("agent:students", filters),
  saveSettings: (settings, authToken) => invoke("agent:save-settings", { settings, authToken }),
  clearAuthToken: () => invoke("agent:clear-token"),
  testGateway: (payload) => invoke("agent:test-gateway", payload),
  createCampaign: (payload) => invoke("agent:create-campaign", payload),
  startCampaign: (campaignId) => invoke("agent:start-campaign", campaignId),
  pauseCampaign: (campaignId) => invoke("agent:pause-campaign", campaignId),
  resumeCampaign: (campaignId) => invoke("agent:resume-campaign", campaignId),
  retryFailed: (campaignId) => invoke("agent:retry-failed", campaignId),
  state: (campaignId) => invoke("agent:state", campaignId),
  exportCampaign: (campaignId) => invoke("agent:export-campaign", campaignId)
});
