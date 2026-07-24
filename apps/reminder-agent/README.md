# Reminder Agent — Google Messages Web automation

Local desktop agent that sends the ERP's approved fee reminders through
**Google Messages for Web**, with one click from the admin after review.

It does **not** run in the browser or on Vercel — Playwright needs a real local
browser process. Run it on the admin's Windows/Mac machine (or inside the
Electron desktop app), where the school phone is paired with Google Messages.

---

## How the pieces fit

```
ERP web app (apps/web)                    Reminder Agent (this package)
──────────────────────                    ─────────────────────────────
Fee Management → Due Reminder             reads "approved" items via the
  loads pending fees                        authenticated ERP API
  builds + previews messages       ──▶     opens Google Messages Web
  admin reviews the Review Queue            (phone paired once via QR)
  clicks "Start Sending"                    for each parent:
    (marks items status:"approved")           start chat → type number →
                                              select → paste message →
ERP history / logs   ◀──  writes back        click Send (auto) → delay → next
  sent / failed / skipped                   daily limit • pause/resume • resume
```

The admin **never clicks Send manually**. The agent enforces the daily SMS
limit, delay between messages, pause-after-X, retries, and crash-safe resume.

---

## One-time setup

```bash
cd apps/reminder-agent
npm install                 # installs Playwright
npm run setup               # downloads the Chromium browser (one time)
cp .env.example .env        # then edit .env
```

Fill `.env`:

- `ERP_BASE_URL` — where your ERP runs (e.g. `http://localhost:3000`).
- `ERP_ADMIN_TOKEN` — a Firebase ID token for an admin with `fees.edit` /
  `fee_reminders` permissions. Get it from the ERP (Automation → Copy agent
  token) or let the desktop app inject it. **Never commit this.**
- `HEADLESS=false` for the first run so you can scan the QR and watch it work.

---

## Daily use

1. **In the ERP:** open Fee Management → Due Reminder Automation, review the
   queue, fix/remove invalid rows, then click **Start Sending**. This marks the
   selected items `approved`.
2. **Run the agent:**
   ```bash
   npm run agent:run       # sends all approved items
   ```
   On the first run a Chromium window opens Google Messages Web. On your phone:
   Messages → ⋮ → **Device pairing** → scan the QR. Pairing is remembered.
3. Watch the console (or the ERP progress panel). When done it prints
   **Sent / Failed / Skipped / Time**.

### Resume after a crash / shutdown / disconnect

Progress is saved after every message. To continue from the last sent parent:

```bash
npm run agent:resume
```

`npm run agent:status` prints the last saved progress without sending.

### Live controls (pause / resume / stop)

The agent exposes a tiny control server (default `http://localhost:4599`):

```bash
curl "http://localhost:4599/control?cmd=pause"
curl "http://localhost:4599/control?cmd=resume"
curl "http://localhost:4599/control?cmd=stop"
curl "http://localhost:4599/progress"      # live JSON progress
```

The ERP progress panel uses these same endpoints
(`lib/reminder/agentClient.ts`).

---

## Settings (read from the ERP)

The agent pulls `fee_reminder_settings` and honours:

| Setting                    | Behaviour                                             |
| -------------------------- | ----------------------------------------------------- |
| `dailyLimitEnabled`        | Enforce a daily cap (default on).                     |
| `dailyLimit`               | Max messages/day (default **300**, never hardcoded).  |
| `delayBetweenSeconds`      | Wait between messages.                                 |
| `pauseAfterEvery`          | Long pause after every N sends (0 = never).           |
| `pauseDurationSeconds`     | How long that pause lasts.                             |
| `retryEnabled`/`retryCount`| Retry a failed send up to N times.                    |
| `skipAlreadySent`          | Skip items already marked sent.                       |
| `messageTemplate`          | `{{parentName}}`, `{{studentName}}`, `{{className}}`, `{{feeType}}`, `{{dueAmount}}`, `{{dueDate}}`, `{{schoolName}}`. |

If the daily limit is reached mid-queue, the remaining items are set
`deferred` ("Continue Tomorrow") — never lost.

---

## Validation (before every send)

Due amount > 0 · parent number present · valid 10-digit mobile · non-empty
message · optional skip-already-sent · duplicate-number guard (one send per
number per run). Invalid rows are marked `skipped` with a reason and logged.

---

## Reliability & limits — read this

- **Terms of Service:** automating Google Messages Web is against Google's ToS
  and can lead to rate-limiting. Use responsibly and within the daily limit.
- **Brittleness:** Google Messages Web has no stable test IDs. All selectors
  live in `src/googleMessages/selectors.ts` with ordered fallbacks — if Google
  changes the UI and a step can't be found, the agent throws a clear
  "update selectors" error instead of sending to the wrong place.
- **Delivery evidence:** a send is only marked `sent` after the outgoing bubble
  appears (or the compose box clears). It is never marked sent merely because a
  click fired.
- **Sequential only:** Google Messages Web is a single surface — messages go one
  at a time by design.
```
