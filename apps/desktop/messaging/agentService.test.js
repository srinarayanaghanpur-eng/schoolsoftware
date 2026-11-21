const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { AgentService } = require("./agentService");

function service() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "narayana-service-"));
  const instance = new AgentService({
    userDataDir: dir,
    safeStorage: null,
    getOrigin: () => "http://127.0.0.1:3456",
    getToken: () => "",
    focusErp: () => undefined
  });
  instance.init();
  return { instance, dir };
}

test("clamps unsafe or invalid limits to safe defaults", () => {
  const { instance, dir } = service();
  try {
    const saved = instance.saveSettings({
      dailyCap: "not-a-number",
      delayMs: -100,
      batchSize: 10000,
      batchPauseMs: "bad",
      maxAttempts: 0,
      cooldownDays: "bad"
    });

    assert.equal(saved.dailyCap, 100);
    assert.equal(saved.delayMs, 1000);
    assert.equal(saved.batchSize, 100);
    assert.equal(saved.batchPauseMs, 60000);
    assert.equal(saved.maxAttempts, 1);
    assert.equal(saved.cooldownDays, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("builds a grouped campaign and reports duplicate/skipped counts", () => {
  const { instance, dir } = service();
  try {
    const result = instance.createCampaign({
      name: "Grouped",
      template: "Hi {{parentName}} - {{children}} - {{totalDue}}",
      students: [
        { id: "s1", studentName: "A", parentName: "P", parentMobile: "9876543210", totalFeesDue: 100 },
        { id: "s2", studentName: "B", parentName: "P", parentMobile: "9876543210", totalFeesDue: 200 },
        { id: "s3", studentName: "C", parentName: "Q", parentMobile: "" }
      ]
    });

    assert.equal(result.campaign.total, 1);
    assert.equal(result.campaign.counts.pending, 1);
    assert.equal(result.skipped.length, 1);
    const row = instance.state(result.campaign.id).recipients[0];
    assert.match(row.message, /A, B/);
    assert.match(row.message, /300/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
