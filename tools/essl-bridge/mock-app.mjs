/**
 * Tiny stand-in for the app's POST /api/biometric/log endpoint.
 * Lets you test the bridge end-to-end without Firebase credentials.
 * It validates the secret and prints what the real app would mark.
 *
 *   node mock-app.mjs            (listens on http://127.0.0.1:4000)
 *
 * Point the bridge at it with API_URL=http://127.0.0.1:4000/api/biometric/log
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT || 4000);
const EXPECTED_SECRET = process.env.MOCK_SECRET || "test-secret";

const server = createServer((req, res) => {
  if (req.method !== "POST" || !req.url.startsWith("/api/biometric/log")) {
    res.writeHead(404).end(JSON.stringify({ ok: false, error: "not found" }));
    return;
  }
  if (req.headers["x-biometric-secret"] !== EXPECTED_SECRET) {
    console.log("REJECTED: bad or missing x-biometric-secret");
    res.writeHead(401).end(JSON.stringify({ ok: false, error: "Invalid biometric API secret" }));
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      res.writeHead(400).end(JSON.stringify({ ok: false, error: "bad json" }));
      return;
    }
    console.log(
      `RECEIVED ✓  device=${payload.deviceId} user=${payload.biometricUserId} ` +
        `${payload.eventType} @ ${payload.timestamp} (${payload.verificationType})`
    );
    res.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({ ok: true, attendanceDocumentId: `mock-${payload.biometricUserId}`, biometricLogId: "mock" })
    );
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Mock app listening on http://127.0.0.1:${PORT}/api/biometric/log (secret: "${EXPECTED_SECRET}")`);
});
