const test = require("node:test");
const assert = require("node:assert/strict");
const { sendSms } = require("./smsGateway");

const baseSettings = {
  gatewayUrl: "http://127.0.0.1:8080/api/send",
  gatewayMethod: "POST",
  gatewayContentType: "json",
  authHeader: "Authorization",
  authTokenPrefix: "Bearer ",
  authToken: "secret",
  toField: "to",
  messageField: "message"
};

test("posts configured JSON fields with the auth token", async () => {
  let captured;
  const result = await sendSms({
    settings: baseSettings,
    to: "919876543210",
    message: "Hello",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ success: true, id: "abc" }), { status: 200 });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.messageId, "abc");
  assert.equal(captured.url, baseSettings.gatewayUrl);
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.Authorization, "Bearer secret");
  assert.deepEqual(JSON.parse(captured.init.body), { to: "919876543210", message: "Hello" });
});

test("supports GET gateways", async () => {
  let capturedUrl = "";
  const result = await sendSms({
    settings: { ...baseSettings, gatewayMethod: "GET", authToken: "" },
    to: "919876543210",
    message: "Hello there",
    fetchImpl: async (url) => {
      capturedUrl = String(url);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  });

  assert.equal(result.ok, true);
  assert.match(capturedUrl, /[?&]to=919876543210/);
  assert.match(capturedUrl, /[?&]message=Hello\+there/);
});

test("posts the SMS Gateway for Android nested payload with Basic auth", async () => {
  let captured;
  const result = await sendSms({
    settings: {
      ...baseSettings,
      gatewayPreset: "sms-gate-app",
      gatewayUrl: "http://192.168.1.132:8080/message",
      authMode: "basic",
      authUsername: "sms",
      authToken: "iEFluwWb",
      authHeader: "",
      authTokenPrefix: ""
    },
    to: "919284843997",
    message: "Fee reminder",
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return new Response(JSON.stringify({ id: "msg_123" }), { status: 202 });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.messageId, "msg_123");
  assert.equal(captured.url, "http://192.168.1.132:8080/message");
  assert.equal(captured.init.method, "POST");
  assert.equal(
    captured.init.headers.Authorization,
    `Basic ${Buffer.from("sms:iEFluwWb").toString("base64")}`
  );
  assert.deepEqual(JSON.parse(captured.init.body), {
    textMessage: { text: "Fee reminder" },
    phoneNumbers: ["+919284843997"]
  });
});

test("requires SMS Gateway username and password", async () => {
  const noUsername = await sendSms({
    settings: { ...baseSettings, gatewayPreset: "sms-gate-app", authUsername: "" },
    to: "919876543210",
    message: "Hello",
    fetchImpl: async () => {
      throw new Error("should not fetch");
    }
  });
  assert.equal(noUsername.ok, false);
  assert.match(noUsername.error, /username/);

  const noPassword = await sendSms({
    settings: {
      ...baseSettings,
      gatewayPreset: "sms-gate-app",
      authUsername: "sms",
      authToken: ""
    },
    to: "919876543210",
    message: "Hello",
    fetchImpl: async () => {
      throw new Error("should not fetch");
    }
  });
  assert.equal(noPassword.ok, false);
  assert.match(noPassword.error, /password/);
});

test("treats explicit gateway failures as errors", async () => {
  const result = await sendSms({
    settings: baseSettings,
    to: "919876543210",
    message: "Hello",
    fetchImpl: async () =>
      new Response(JSON.stringify({ success: false, error: "SIM not ready" }), { status: 200 })
  });

  assert.equal(result.ok, false);
  assert.equal(result.retryable, false);
  assert.match(result.error, /SIM not ready/);
});
