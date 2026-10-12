#!/usr/bin/env node
/**
 * get-drive-refresh-token.js
 * --------------------------
 * One-time helper for the nightly Google Drive backup (Batch C).
 *
 * Runs a tiny local web server, walks you through Google's OAuth consent, and
 * prints the refresh token you paste into GOOGLE_DRIVE_REFRESH_TOKEN.
 *
 * Usage:
 *   GOOGLE_DRIVE_CLIENT_ID=xxxx.apps.googleusercontent.com \
 *   GOOGLE_DRIVE_CLIENT_SECRET=xxxx \
 *   node scripts/get-drive-refresh-token.js
 *
 * In Google Cloud Console, add this exact redirect URI to the OAuth client:
 *   http://localhost:53682
 * (override with GOOGLE_DRIVE_REDIRECT_PORT)
 *
 * Least privilege by default: scope "drive.file" only lets this app touch the
 * files it created. To use an existing folder reliably, re-run with:
 *   DRIVE_SCOPE=https://www.googleapis.com/auth/drive node scripts/get-drive-refresh-token.js
 *
 * NEVER commit the printed token. It is a long-lived credential.
 */

const http = require("http");
const { URL } = require("url");

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID || process.argv[2] || "";
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.argv[3] || "";
const PORT = Number(process.env.GOOGLE_DRIVE_REDIRECT_PORT || 53682);
const SCOPE = process.env.DRIVE_SCOPE || "https://www.googleapis.com/auth/drive.file";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET.\n" +
      "Get them from Google Cloud Console -> APIs & Services -> Credentials."
  );
  process.exit(1);
}

const redirectUri = `http://localhost:${PORT}`;
const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true"
  }).toString();

async function exchangeCode(code) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }).toString()
  });
  const payload = await response.json();
  if (!response.ok || !payload.refresh_token) {
    throw new Error(payload.error_description || payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);

  if (url.pathname !== "/") {
    res.writeHead(404).end("Not found");
    return;
  }

  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");

  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/plain" }).end(`Authorization failed: ${error || "no code"}`);
    console.error(`Authorization failed: ${error || "no code returned"}`);
    server.close();
    process.exit(1);
  }

  try {
    const payload = await exchangeCode(code);
    res.writeHead(200, { "Content-Type": "text/plain" })
      .end("Success. You can close this tab and return to the terminal.");
    console.log("\n----------------------------------------");
    console.log("GOOGLE_DRIVE_REFRESH_TOKEN=" + payload.refresh_token);
    console.log("----------------------------------------");
    console.log("Add it to env.example / Vercel env, then delete this line from history if needed.");
    server.close();
    process.exit(0);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" }).end("Token exchange failed, see terminal.");
    console.error("Token exchange failed:", err instanceof Error ? err.message : err);
    server.close();
    process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log("Open this URL in your browser, approve access:\n");
  console.log(authUrl + "\n");
  console.log(`Waiting for redirect on ${redirectUri} ...`);
});
