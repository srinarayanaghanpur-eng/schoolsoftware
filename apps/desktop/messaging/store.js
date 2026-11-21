const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_SETTINGS = {
  gatewayPreset: "generic",
  gatewayUrl: "http://192.168.1.50:8080/api/send",
  gatewayMethod: "POST",
  gatewayContentType: "json",
  authMode: "bearer",
  authUsername: "",
  authHeader: "Authorization",
  authTokenPrefix: "Bearer ",
  toField: "to",
  messageField: "message",
  deviceField: "",
  deviceId: "",
  senderField: "",
  senderId: "",
  dailyCap: 100,
  delayMs: 5000,
  batchSize: 20,
  batchPauseMs: 60000,
  maxAttempts: 3,
  cooldownDays: 7,
  schoolName: "Sri Narayana High School",
  template:
    "Dear {{parentName}}, fee due for {{children}} is Rs.{{totalDue}}. Kindly pay at the school office. - {{schoolName}}"
};

const EMPTY_DB = {
  version: 1,
  settings: { ...DEFAULT_SETTINGS },
  campaigns: [],
  recipients: []
};

function nowIso() {
  return new Date().toISOString();
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

class QueueStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
  }

  init() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    if (!fs.existsSync(this.filePath)) {
      this.data = JSON.parse(JSON.stringify(EMPTY_DB));
      this.save();
      return;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      this.data = {
        ...JSON.parse(JSON.stringify(EMPTY_DB)),
        ...parsed,
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
        recipients: Array.isArray(parsed.recipients) ? parsed.recipients : []
      };
    } catch {
      const backup = `${this.filePath}.corrupt-${Date.now()}`;
      try {
        fs.copyFileSync(this.filePath, backup);
      } catch {
        // Best effort only.
      }
      this.data = JSON.parse(JSON.stringify(EMPTY_DB));
      this.save();
    }
  }

  save() {
    const temp = `${this.filePath}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), "utf8");
    try {
      fs.renameSync(temp, this.filePath);
    } catch {
      fs.rmSync(this.filePath, { force: true });
      fs.renameSync(temp, this.filePath);
    }
  }

  getSettings() {
    return { ...DEFAULT_SETTINGS, ...(this.data.settings || {}) };
  }

  updateSettings(patch) {
    this.data.settings = { ...this.getSettings(), ...(patch || {}) };
    this.save();
    return this.getSettings();
  }

  listCampaigns() {
    return [...this.data.campaigns]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map((campaign) => this.campaignSummary(campaign));
  }

  getCampaign(campaignId) {
    const campaign = this.data.campaigns.find((item) => item.id === campaignId);
    return campaign ? this.campaignSummary(campaign) : null;
  }

  campaignSummary(campaign) {
    const rows = this.data.recipients.filter((item) => item.campaignId === campaign.id);
    const counts = { pending: 0, sending: 0, sent: 0, opened: 0, failed: 0, duplicate: 0, skipped: 0 };
    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) counts[row.status] += 1;
    }
    return {
      ...campaign,
      counts,
      total: rows.length
    };
  }

  createCampaign({ name, channel, template, filters }, recipients) {
    const createdAt = nowIso();
    const campaign = {
      id: id("camp"),
      name: String(name || "SMS campaign").trim() || "SMS campaign",
      channel: String(channel || "sms"),
      template: String(template || ""),
      filters: filters || {},
      status: "ready",
      pauseReason: "",
      createdAt,
      updatedAt: createdAt,
      startedAt: "",
      completedAt: ""
    };

    const rows = recipients.map((recipient) => ({
      id: id("rcp"),
      campaignId: campaign.id,
      studentId: String(recipient.studentId || ""),
      studentIds: Array.isArray(recipient.studentIds) ? recipient.studentIds : [],
      studentName: String(recipient.studentName || ""),
      admissionNumber: String(recipient.admissionNumber || ""),
      parentName: String(recipient.parentName || "Parent"),
      phone: String(recipient.phone || ""),
      className: String(recipient.className || ""),
      section: String(recipient.section || ""),
      dueAmount: Number(recipient.dueAmount || 0),
      studentCount: Number(recipient.studentCount || 1),
      message: String(recipient.message || ""),
      dedupeKey: String(recipient.dedupeKey || recipient.phone || ""),
      status: "pending",
      attempts: 0,
      lastError: "",
      providerMessageId: "",
      sentAt: "",
      createdAt,
      updatedAt: createdAt
    }));

    this.data.campaigns.push(campaign);
    this.data.recipients.push(...rows);
    this.save();
    return this.campaignSummary(campaign);
  }

  updateCampaign(campaignId, patch) {
    const campaign = this.data.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return null;
    Object.assign(campaign, patch || {}, { updatedAt: nowIso() });
    this.save();
    return this.campaignSummary(campaign);
  }

  listRecipients(campaignId, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 250), 500));
    const status = String(options.status || "");
    return this.data.recipients
      .filter((item) => item.campaignId === campaignId && (!status || item.status === status))
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .slice(0, limit)
      .map((item) => ({ ...item }));
  }

  nextPending(campaignId) {
    const row = this.data.recipients.find(
      (item) => item.campaignId === campaignId && item.status === "pending"
    );
    return row ? { ...row } : null;
  }

  updateRecipient(recipientId, patch) {
    const row = this.data.recipients.find((item) => item.id === recipientId);
    if (!row) return null;
    Object.assign(row, patch || {}, { updatedAt: nowIso() });
    this.save();
    return { ...row };
  }

  sentTodayCount() {
    const today = todayKey();
    return this.data.recipients.filter((item) => {
      if (item.status !== "sent" || !item.sentAt) return false;
      const sentAt = new Date(item.sentAt);
      return Number.isFinite(sentAt.getTime()) && todayKey(sentAt) === today;
    }).length;
  }

  recentPhones(days) {
    const cutoff = Date.now() - Math.max(0, Number(days || 0)) * 24 * 60 * 60 * 1000;
    const phones = new Set();
    for (const row of this.data.recipients) {
      if (row.status !== "sent" || !row.sentAt) continue;
      const timestamp = new Date(row.sentAt).getTime();
      if (Number.isFinite(timestamp) && timestamp >= cutoff) phones.add(row.phone);
    }
    return phones;
  }

  hasRecentSend(phone, days, excludeRecipientId = "") {
    const cutoff = Date.now() - Math.max(0, Number(days || 0)) * 24 * 60 * 60 * 1000;
    for (const row of this.data.recipients) {
      if (row.id === excludeRecipientId || row.phone !== phone) continue;
      if (row.status !== "sent" || !row.sentAt) continue;
      const timestamp = new Date(row.sentAt).getTime();
      if (Number.isFinite(timestamp) && timestamp >= cutoff) return true;
    }
    return false;
  }

  recoverInterrupted() {
    let changed = 0;
    for (const row of this.data.recipients) {
      if (row.status !== "sending") continue;
      row.status = "failed";
      row.lastError = "App closed while sending. Verify with the gateway before retrying.";
      row.updatedAt = nowIso();
      changed += 1;
    }
    for (const campaign of this.data.campaigns) {
      if (campaign.status !== "running") continue;
      campaign.status = "paused";
      campaign.pauseReason = "App restarted while sending";
      campaign.updatedAt = nowIso();
      changed += 1;
    }
    if (changed > 0) this.save();
    return changed;
  }

  retryFailed(campaignId) {
    const maxAttempts = Math.max(1, Number(this.getSettings().maxAttempts || 3));
    let changed = 0;
    for (const row of this.data.recipients) {
      if (row.campaignId !== campaignId || row.status !== "failed") continue;
      if (Number(row.attempts || 0) >= maxAttempts) continue;
      row.status = "pending";
      row.lastError = "";
      row.updatedAt = nowIso();
      changed += 1;
    }
    if (changed > 0) {
      const campaign = this.data.campaigns.find((item) => item.id === campaignId);
      if (campaign && campaign.status === "completed") {
        campaign.status = "paused";
        campaign.pauseReason = "Retry queued";
        campaign.updatedAt = nowIso();
      }
      this.save();
    }
    return changed;
  }

  exportCampaign(campaignId) {
    const campaign = this.data.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return [];
    return this.data.recipients
      .filter((item) => item.campaignId === campaignId)
      .map((item) => ({
        parentName: item.parentName,
        phone: item.phone,
        studentName: item.studentName,
        className: item.className,
        section: item.section,
        dueAmount: item.dueAmount,
        status: item.status,
        attempts: item.attempts,
        sentAt: item.sentAt,
        providerMessageId: item.providerMessageId,
        lastError: item.lastError
      }));
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  QueueStore,
  todayKey,
  nowIso
};

