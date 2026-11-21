const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { QueueStore } = require("./store");
const { CampaignRunner } = require("./campaignRunner");

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "narayana-runner-"));
  const store = new QueueStore(path.join(dir, "queue.json"));
  store.init();
  store.updateSettings({ delayMs: 1000, batchSize: 100, batchPauseMs: 0, dailyCap: 100 });
  return { store, dir };
}

function waitFor(predicate, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for campaign"));
      }
    }, 50);
  });
}

test("sends pending recipients and completes the campaign", async () => {
  const { store, dir } = setup();
  try {
    let sends = 0;
    const runner = new CampaignRunner({
      store,
      sender: async () => {
        sends += 1;
        return { ok: true, messageId: `msg-${sends}` };
      }
    });
    const campaign = store.createCampaign(
      { name: "Runner", channel: "sms", template: "Hello", filters: {} },
      [{ phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" }]
    );

    await runner.start(campaign.id);
    await waitFor(() => store.getCampaign(campaign.id).status === "completed");

    assert.equal(sends, 1);
    assert.equal(store.getCampaign(campaign.id).counts.sent, 1);
    assert.equal(store.sentTodayCount(), 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("records failures without throwing out of the runner", async () => {
  const { store, dir } = setup();
  try {
    const runner = new CampaignRunner({
      store,
      sender: async () => ({ ok: false, retryable: false, error: "Gateway rejected" })
    });
    const campaign = store.createCampaign(
      { name: "Failure", channel: "sms", template: "Hello", filters: {} },
      [{ phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" }]
    );

    await runner.start(campaign.id);
    await waitFor(() => store.getCampaign(campaign.id).status === "completed");

    assert.equal(store.getCampaign(campaign.id).counts.failed, 1);
    assert.match(store.exportCampaign(campaign.id)[0].lastError, /Gateway rejected/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("does not resend a phone inside the duplicate cooldown", async () => {
  const { store, dir } = setup();
  try {
    let sends = 0;
    const runner = new CampaignRunner({
      store,
      sender: async () => {
        sends += 1;
        return { ok: true, messageId: `msg-${sends}` };
      }
    });
    const first = store.createCampaign(
      { name: "First", channel: "sms", template: "Hello", filters: {} },
      [{ phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" }]
    );
    await runner.start(first.id);
    await waitFor(() => store.getCampaign(first.id).status === "completed");

    const second = store.createCampaign(
      { name: "Second", channel: "sms", template: "Hello", filters: {} },
      [{ phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" }]
    );
    await runner.start(second.id);
    await waitFor(() => store.getCampaign(second.id).status === "completed");

    assert.equal(sends, 1);
    assert.equal(store.getCampaign(second.id).counts.duplicate, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("pauses at the daily cap and leaves the rest pending", async () => {
  const { store, dir } = setup();
  try {
    store.updateSettings({ dailyCap: 1 });
    let sends = 0;
    const runner = new CampaignRunner({
      store,
      sender: async () => {
        sends += 1;
        return { ok: true, messageId: `msg-${sends}` };
      }
    });
    const campaign = store.createCampaign(
      { name: "Capped", channel: "sms", template: "Hello", filters: {} },
      [
        { phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" },
        { phone: "919876543211", parentName: "B", studentName: "Two", message: "Hello" }
      ]
    );

    await runner.start(campaign.id);
    await waitFor(() => store.getCampaign(campaign.id).status === "paused");

    assert.equal(sends, 1);
    assert.equal(store.getCampaign(campaign.id).counts.sent, 1);
    assert.equal(store.getCampaign(campaign.id).counts.pending, 1);
    assert.match(store.getCampaign(campaign.id).pauseReason, /Daily cap/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
