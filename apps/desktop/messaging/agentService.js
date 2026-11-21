const path = require("path");
const { QueueStore } = require("./store");
const { SecureStore } = require("./secureStore");
const { ErpClient } = require("./erpClient");
const { CampaignRunner } = require("./campaignRunner");
const { buildRecipients, DEFAULT_TEMPLATE, normalizePhone } = require("./recipients");
const { sendSms } = require("./smsGateway");

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max, fallback) {
  return Math.max(min, Math.min(max, finiteNumber(value, fallback)));
}

const SETTING_KEYS = new Set([
  "gatewayPreset",
  "gatewayUrl",
  "gatewayMethod",
  "gatewayContentType",
  "authMode",
  "authUsername",
  "authHeader",
  "authTokenPrefix",
  "toField",
  "messageField",
  "deviceField",
  "deviceId",
  "senderField",
  "senderId",
  "dailyCap",
  "delayMs",
  "batchSize",
  "batchPauseMs",
  "maxAttempts",
  "cooldownDays",
  "schoolName",
  "template"
]);

class AgentService {
  constructor({ userDataDir, safeStorage, getOrigin, getToken, focusErp }) {
    this.getOrigin = getOrigin;
    this.getToken = getToken;
    this.focusErp = focusErp;

    const base = path.join(userDataDir, "messaging");
    this.store = new QueueStore(path.join(base, "queue.json"));
    this.secrets = new SecureStore(path.join(base, "secrets.json"), safeStorage);
    this.erp = new ErpClient({ getOrigin, getToken });
    this.runner = null;
  }

  init() {
    this.store.init();
    this.secrets.init();
    this.store.recoverInterrupted();
    this.runner = new CampaignRunner({
      store: this.store,
      sender: async ({ row, settings }) => {
        const authToken = this.secrets.get("smsGatewayToken");
        return sendSms({
          settings: { ...settings, authToken },
          to: row.phone,
          message: row.message
        });
      }
    });
  }

  publicSettings() {
    const settings = this.store.getSettings();
    return {
      ...settings,
      hasAuthToken: this.secrets.has("smsGatewayToken"),
      defaultTemplate: DEFAULT_TEMPLATE
    };
  }

  bootstrap() {
    return {
      erpOrigin: String(this.getOrigin() || ""),
      erpTokenAvailable: Boolean(this.getToken()),
      sentToday: this.store.sentTodayCount(),
      campaigns: this.store.listCampaigns(),
      settings: this.publicSettings()
    };
  }

  saveSettings(patch, authToken) {
    const input = patch && typeof patch === "object" ? patch : {};
    const next = {};
    for (const [key, value] of Object.entries(input)) {
      if (!SETTING_KEYS.has(key)) continue;
      if (["dailyCap", "delayMs", "batchSize", "batchPauseMs", "maxAttempts", "cooldownDays"].includes(key)) {
        next[key] = Number(value);
      } else {
        next[key] = String(value ?? "");
      }
    }

    if (next.dailyCap !== undefined) next.dailyCap = clampNumber(next.dailyCap, 1, 500, 100);
    if (next.delayMs !== undefined) next.delayMs = clampNumber(next.delayMs, 1000, 120000, 5000);
    if (next.batchSize !== undefined) next.batchSize = clampNumber(next.batchSize, 1, 100, 20);
    if (next.batchPauseMs !== undefined) next.batchPauseMs = clampNumber(next.batchPauseMs, 0, 600000, 60000);
    if (next.maxAttempts !== undefined) next.maxAttempts = clampNumber(next.maxAttempts, 1, 5, 3);
    if (next.cooldownDays !== undefined) next.cooldownDays = clampNumber(next.cooldownDays, 0, 90, 0);

    this.store.updateSettings(next);

    if (typeof authToken === "string" && authToken.trim()) {
      this.secrets.set("smsGatewayToken", authToken.trim());
    }
    return this.publicSettings();
  }

  clearAuthToken() {
    this.secrets.clear("smsGatewayToken");
    return this.publicSettings();
  }

  async academicYears() {
    return this.erp.academicYears();
  }

  async students(filters) {
    return this.erp.students(filters || {});
  }

  createCampaign(input) {
    const payload = input && typeof input === "object" ? input : {};
    const students = Array.isArray(payload.students) ? payload.students : [];
    if (students.length === 0) throw new Error("Select at least one student");
    const settings = this.store.getSettings();
    const template = String(payload.template || settings.template || DEFAULT_TEMPLATE);
    const channel = String(payload.channel || "sms");
    if (channel !== "sms") throw new Error("Only SMS is enabled in this build");

    const built = buildRecipients(students, {
      max: 500,
      cooldownPhones: this.store.recentPhones(settings.cooldownDays),
      template,
      schoolName: settings.schoolName
    });

    if (built.recipients.length === 0) {
      const reasons = [];
      if (built.duplicates.length) reasons.push(`${built.duplicates.length} messaged recently`);
      if (built.skipped.length) reasons.push(`${built.skipped.length} invalid/missing mobile`);
      throw new Error(
        `No valid recipients${reasons.length ? ` (${reasons.join(", ")})` : ""}. Set cooldown to 0 to resend.`
      );
    }

    const campaign = this.store.createCampaign(
      {
        name: payload.name,
        channel,
        template,
        filters: payload.filters || {}
      },
      built.recipients
    );

    return {
      campaign,
      skipped: built.skipped,
      duplicates: built.duplicates,
      overflow: built.overflow
    };
  }

  async start(campaignId) {
    return this.runner.start(String(campaignId || ""));
  }

  pause(campaignId) {
    return this.runner.pause(String(campaignId || ""));
  }

  async resume(campaignId) {
    return this.runner.resume(String(campaignId || ""));
  }

  retryFailed(campaignId) {
    return this.runner.retryFailed(String(campaignId || ""));
  }

  async testGateway({ to, message }) {
    const settings = this.store.getSettings();
    const authToken = this.secrets.get("smsGatewayToken");
    const rawTo = String(to || "").trim();
    return sendSms({
      settings: { ...settings, authToken },
      to: normalizePhone(rawTo) || rawTo,
      message: String(message || "Sri Narayana ERP SMS gateway test")
    });
  }

  state(campaignId) {
    const campaign = campaignId ? this.store.getCampaign(String(campaignId)) : null;
    return {
      campaigns: this.store.listCampaigns(),
      campaign,
      recipients: campaign ? this.store.listRecipients(campaign.id, { limit: 500 }) : [],
      sentToday: this.store.sentTodayCount(),
      settings: this.publicSettings(),
      erpTokenAvailable: Boolean(this.getToken())
    };
  }

  exportCampaign(campaignId) {
    return this.store.exportCampaign(String(campaignId || ""));
  }

  stopAll() {
    if (this.runner) this.runner.stopAll();
  }
}

module.exports = { AgentService, SETTING_KEYS };
