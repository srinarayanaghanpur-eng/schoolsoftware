const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { QueueStore } = require("./store");

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "narayana-queue-"));
  const store = new QueueStore(path.join(dir, "queue.json"));
  store.init();
  return { store, dir };
}

test("creates campaigns and tracks status counts", () => {
  const { store, dir } = tempStore();
  try {
    const campaign = store.createCampaign(
      { name: "Test", channel: "sms", template: "Hello", filters: {} },
      [
        { phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" },
        { phone: "919876543211", parentName: "B", studentName: "Two", message: "Hello" }
      ]
    );

    assert.equal(campaign.total, 2);
    assert.equal(campaign.counts.pending, 2);
    assert.equal(store.nextPending(campaign.id).phone, "919876543210");

    const row = store.nextPending(campaign.id);
    store.updateRecipient(row.id, { status: "sent", sentAt: new Date().toISOString() });
    const updated = store.getCampaign(campaign.id);
    assert.equal(updated.counts.sent, 1);
    assert.equal(updated.counts.pending, 1);
    assert.equal(store.sentTodayCount(), 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("retries failed recipients only when attempts remain", () => {
  const { store, dir } = tempStore();
  try {
    store.updateSettings({ maxAttempts: 3 });
    const campaign = store.createCampaign(
      { name: "Retry", channel: "sms", template: "Hello", filters: {} },
      [{ phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" }]
    );
    const row = store.nextPending(campaign.id);
    store.updateRecipient(row.id, { status: "failed", attempts: 3, lastError: "Timeout" });

    assert.equal(store.retryFailed(campaign.id), 0);
    store.updateRecipient(row.id, { attempts: 2 });
    assert.equal(store.retryFailed(campaign.id), 1);
    assert.equal(store.nextPending(campaign.id).status, "pending");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("recovers interrupted sends and exports campaign rows", () => {
  const { store, dir } = tempStore();
  try {
    const campaign = store.createCampaign(
      { name: "Export", channel: "sms", template: "Hello", filters: {} },
      [{ phone: "919876543210", parentName: "A", studentName: "One", message: "Hello" }]
    );
    const row = store.nextPending(campaign.id);
    store.updateRecipient(row.id, { status: "sending" });

    assert.equal(store.recoverInterrupted(), 1);
    assert.equal(store.nextPending(campaign.id), null);

    const rows = store.exportCampaign(campaign.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "failed");
    assert.match(rows[0].lastError, /App closed/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
