function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

class CampaignRunner {
  constructor({ store, sender }) {
    this.store = store;
    this.sender = sender;
    this.activeCampaignId = "";
    this.running = false;
    this.loopPromise = null;
  }

  isRunning(campaignId) {
    return this.running && this.activeCampaignId === campaignId;
  }

  async start(campaignId) {
    const campaign = this.store.getCampaign(campaignId);
    if (!campaign) throw new Error("Campaign not found");
    if (this.isRunning(campaignId)) return campaign;

    if (this.activeCampaignId) {
      this.pause(this.activeCampaignId);
      await this.loopPromise?.catch(() => undefined);
    }

    const pending = this.store.nextPending(campaignId);
    if (!pending) {
      return this.store.updateCampaign(campaignId, {
        status: campaign.counts.failed > 0 ? "completed" : "completed",
        pauseReason: campaign.counts.failed > 0 ? "No pending recipients. Use Retry failed." : ""
      });
    }

    this.activeCampaignId = campaignId;
    this.running = true;
    const updated = this.store.updateCampaign(campaignId, {
      status: "running",
      pauseReason: "",
      startedAt: campaign.startedAt || new Date().toISOString(),
      completedAt: ""
    });
    this.loopPromise = this.loop(campaignId).catch((error) => {
      this.running = false;
      this.activeCampaignId = "";
      this.store.updateCampaign(campaignId, {
        status: "paused",
        pauseReason: error instanceof Error ? error.message : "Campaign stopped unexpectedly"
      });
    });
    return updated;
  }

  pause(campaignId) {
    const campaign = this.store.getCampaign(campaignId);
    if (!campaign) return null;
    const updated = this.store.updateCampaign(campaignId, {
      status: "paused",
      pauseReason: "Paused by operator"
    });
    if (this.activeCampaignId === campaignId) this.running = false;
    return updated;
  }

  async resume(campaignId) {
    return this.start(campaignId);
  }

  retryFailed(campaignId) {
    return this.store.retryFailed(campaignId);
  }

  stopAll() {
    this.running = false;
  }

  async loop(campaignId) {
    const settings = this.store.getSettings();
    const dailyCap = Math.max(1, finiteNumber(settings.dailyCap, 100));
    const batchSize = Math.max(1, finiteNumber(settings.batchSize, 20));
    const batchPauseMs = Math.max(0, finiteNumber(settings.batchPauseMs, 60000));
    const baseDelay = Math.max(0, finiteNumber(settings.delayMs, 5000));
    let batchCount = 0;

    try {
      while (this.isRunning(campaignId)) {
        const row = this.store.nextPending(campaignId);
        if (!row) {
          this.running = false;
          const summary = this.store.getCampaign(campaignId);
          this.store.updateCampaign(campaignId, {
            status: "completed",
            completedAt: new Date().toISOString(),
            pauseReason:
              summary && summary.counts.failed > 0
                ? `${summary.counts.failed} failed. Use Retry failed.`
                : ""
          });
          break;
        }

        if (this.store.hasRecentSend(row.phone, settings.cooldownDays, row.id)) {
          this.store.updateRecipient(row.id, {
            status: "duplicate",
            lastError: "Already messaged within the duplicate cooldown"
          });
          continue;
        }

        if (this.store.sentTodayCount() >= dailyCap) {
          this.running = false;
          this.store.updateCampaign(campaignId, {
            status: "paused",
            pauseReason: `Daily cap reached (${dailyCap})`
          });
          break;
        }

        const attempts = Number(row.attempts || 0) + 1;
        this.store.updateRecipient(row.id, {
          status: "sending",
          attempts,
          lastError: ""
        });

        const result = await this.sendWithRetry(row, settings);
        if (!this.isRunning(campaignId)) {
          if (result.ok) {
            this.store.updateRecipient(row.id, {
              status: "sent",
              sentAt: new Date().toISOString(),
              providerMessageId: result.messageId || "",
              lastError: ""
            });
          } else {
            this.store.updateRecipient(row.id, {
              status: "failed",
              lastError: result.error || "Send failed after pause"
            });
          }
          break;
        }

        if (result.ok) {
          this.store.updateRecipient(row.id, {
            status: "sent",
            sentAt: new Date().toISOString(),
            providerMessageId: result.messageId || "",
            lastError: ""
          });
          batchCount += 1;
        } else {
          this.store.updateRecipient(row.id, {
            status: "failed",
            lastError: result.error || "Send failed"
          });
        }

        if (batchCount >= batchSize) {
          batchCount = 0;
          await this.wait(campaignId, batchPauseMs);
        } else {
          const jitter = Math.floor(baseDelay * 0.2 * (Math.random() * 2 - 1));
          await this.wait(campaignId, Math.max(1000, baseDelay + jitter));
        }
      }
    } finally {
      if (this.activeCampaignId === campaignId) {
        this.running = false;
        this.activeCampaignId = "";
      }
    }
  }

  async sendWithRetry(row, settings) {
    const maxAttempts = Math.max(1, finiteNumber(settings.maxAttempts, 3));
    let attempt = 0;
    let last = { ok: false, retryable: false, error: "Send failed", messageId: "" };

    while (attempt < maxAttempts) {
      attempt += 1;
      last = await this.sender({ row, settings });
      if (last.ok) return last;
      if (!last.retryable || attempt >= maxAttempts) return last;
      await sleep(Math.min(10000, 1500 * attempt));
    }
    return last;
  }

  async wait(campaignId, ms) {
    const deadline = Date.now() + Math.max(0, Number(ms) || 0);
    while (Date.now() < deadline) {
      if (!this.isRunning(campaignId)) return;
      await sleep(Math.min(500, deadline - Date.now()));
    }
  }
}

module.exports = { CampaignRunner, sleep };
