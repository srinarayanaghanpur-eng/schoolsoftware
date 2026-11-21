function normalizeMethod(value) {
  return String(value || "POST").toUpperCase() === "GET" ? "GET" : "POST";
}

function normalizeContentType(value) {
  return String(value || "json").toLowerCase() === "form" ? "form" : "json";
}

function isSmsGateApp(settings) {
  return String(settings?.gatewayPreset || "") === "sms-gate-app";
}

function e164Phone(value) {
  const raw = String(value || "").trim();
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : raw;
}

function buildSmsGatePayload(to, message) {
  return {
    textMessage: { text: String(message || "") },
    phoneNumbers: [e164Phone(to)]
  };
}

function authHeaders(settings, token) {
  const value = String(token || "");
  if (!value) return {};
  const mode = String(settings.authMode || "bearer").toLowerCase();
  if (mode === "none" && !isSmsGateApp(settings)) return {};

  if (mode === "basic" || isSmsGateApp(settings)) {
    const username = String(settings.authUsername || "");
    return {
      Authorization: `Basic ${Buffer.from(`${username}:${value}`).toString("base64")}`
    };
  }

  const headerName = String(settings.authHeader || "Authorization");
  return { [headerName]: `${String(settings.authTokenPrefix || "")}${value}` };
}

function buildFields(settings, to, message) {
  const fields = {};
  const toField = String(settings.toField || "to");
  const messageField = String(settings.messageField || "message");
  fields[toField] = to;
  fields[messageField] = message;

  if (settings.deviceField && settings.deviceId) {
    fields[String(settings.deviceField)] = String(settings.deviceId);
  }
  if (settings.senderField && settings.senderId) {
    fields[String(settings.senderField)] = String(settings.senderId);
  }
  return fields;
}

function parseBody(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function providerMessageId(payload) {
  return String(
    payload?.messageId ||
      payload?.message_id ||
      payload?.id ||
      payload?.sid ||
      payload?.data?.messageId ||
      payload?.data?.id ||
      ""
  );
}

function explicitFailure(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (payload.success === false) return String(payload.error || payload.message || "Gateway returned success=false");
  if (payload.ok === false) return String(payload.error || payload.message || "Gateway returned ok=false");
  if (payload.status && /^(error|failed|failure)$/i.test(String(payload.status))) {
    return String(payload.error || payload.message || `Gateway status: ${payload.status}`);
  }
  if (payload.error) {
    if (typeof payload.error === "string") return payload.error;
    if (typeof payload.error === "object") {
      return String(payload.error.message || payload.error.description || JSON.stringify(payload.error));
    }
  }
  return "";
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function sendSms({ settings, to, message, fetchImpl = globalThis.fetch, timeoutMs = 20000 }) {
  const url = String(settings.gatewayUrl || "").trim();
  if (!url) {
    return { ok: false, retryable: false, messageId: "", error: "SMS gateway URL is not configured" };
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, retryable: false, messageId: "", error: "SMS gateway URL is invalid" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, retryable: false, messageId: "", error: "SMS gateway URL must use http or https" };
  }

  const smsGate = isSmsGateApp(settings);
  const token = String(settings.authToken || "");
  if (smsGate) {
    if (!String(settings.authUsername || "").trim()) {
      return { ok: false, retryable: false, messageId: "", error: "Gateway username is not configured" };
    }
    if (!token) {
      return { ok: false, retryable: false, messageId: "", error: "Gateway password is not configured" };
    }
  }

  const headers = { Accept: "application/json, text/plain, */*", ...authHeaders(settings, token) };
  let requestUrl = parsed.toString();
  let body;
  let method;
  let contentType;

  if (smsGate) {
    method = "POST";
    contentType = "json";
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(buildSmsGatePayload(to, message));
  } else {
    const fields = buildFields(settings, to, message);
    method = normalizeMethod(settings.gatewayMethod);
    contentType = normalizeContentType(settings.gatewayContentType);

    if (method === "GET") {
      const query = new URLSearchParams(fields);
      requestUrl = `${requestUrl}${requestUrl.includes("?") ? "&" : "?"}${query.toString()}`;
    } else if (contentType === "form") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(fields).toString();
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(fields);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs || 20000)));

  try {
    const response = await fetchImpl(requestUrl, {
      method,
      headers,
      body,
      redirect: "error",
      signal: controller.signal
    });

    const text = await response.text();
    const payload = parseBody(text);
    const failure = explicitFailure(payload);
    const ok = response.ok && !failure;

    return {
      ok,
      retryable: !ok && retryableStatus(response.status),
      messageId: ok ? providerMessageId(payload) : "",
      error: ok ? "" : failure || `Gateway returned HTTP ${response.status}`,
      status: response.status,
      response: text.slice(0, 500)
    };
  } catch (error) {
    const messageText =
      error?.name === "AbortError"
        ? "SMS gateway timed out"
        : error instanceof Error
          ? error.message
          : "SMS gateway request failed";
    return {
      ok: false,
      retryable: true,
      messageId: "",
      error: messageText
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  sendSms,
  buildFields,
  buildSmsGatePayload,
  isSmsGateApp,
  e164Phone,
  providerMessageId,
  explicitFailure,
  normalizeMethod,
  normalizeContentType
};
