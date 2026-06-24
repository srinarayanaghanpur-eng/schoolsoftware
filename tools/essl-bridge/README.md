# eSSL Bridge

Connects an **eSSL / ZKTeco biometric device** to the attendance app.

The device speaks the ZKTeco protocol over your LAN (TCP **4370**). Your app runs
in the cloud and can't reach the device directly, so this small program runs on a
**PC on the same network as the device**. It reads punches and forwards them to the
app's existing endpoint `POST /api/biometric/log`, which marks attendance.

```
[eSSL device] --TCP 4370--> [this bridge on a LAN PC] --HTTPS--> [your app /api/biometric/log] --> Firestore attendance
```

## One-time setup

1. **Install Node.js 18+** on the PC that stays on the same network as the device.
2. In this folder, run:
   ```
   npm install
   ```
3. Copy the config and fill it in:
   ```
   copy .env.example .env
   ```
   Edit `.env`:
   - `DEVICE_IP` — the device's IP (Menu ▸ Comm ▸ Ethernet on the device).
   - `API_URL` — your app endpoint, e.g. `https://your-app.vercel.app/api/biometric/log`.
   - `BIOMETRIC_API_SECRET` — must match `BIOMETRIC_API_SECRET` in your app's Vercel
     env vars (or `settings.biometricApiSecret` in Firestore).
4. **Map each teacher to their device enrollment number.** In the app:
   Admin ▸ Teachers ▸ edit teacher ▸ set **Biometric User ID** to the number that
   teacher is enrolled under on the eSSL device. If these don't match, the punch is
   logged but no attendance is marked.

## Use it

```bash
npm run test-connection   # verify the bridge can reach the device
npm run sync              # pull today's punches once and forward them
npm run sync:loop         # keep running, poll every POLL_INTERVAL_SECONDS
```

`sync` is safe to run repeatedly — a local `.state.json` remembers what was already
sent, so punches are never double-posted.

## Run it automatically (Windows Task Scheduler)

To sync every 5 minutes without leaving a window open:

1. Open **Task Scheduler ▸ Create Task**.
2. Trigger: **Daily**, repeat task every **5 minutes** for a duration of **1 day**.
3. Action: **Start a program**
   - Program: `node`
   - Arguments: `sync.mjs`
   - Start in: this folder's full path (e.g. `C:\Users\HP\OneDrive\Desktop\ATTENDANCE\tools\essl-bridge`)
4. Check "Run whether user is logged on or not" so it runs in the background.

(Or just run `npm run sync:loop` in a terminal on a PC that stays on.)

## How check-in / check-out is decided

The simple ZKTeco read doesn't reliably report a punch's "in/out" state, so the
bridge uses the natural rule that matches the app's merge logic:

- A user's **first** punch of the day → `checkin` (this sets present/late status)
- A user's **last** punch of the day → `checkout`

If you only ever want one stamp per day, that still works — a single punch is
recorded as the check-in.

## Notes

- Assumes this PC's clock is in the **same timezone as the device** (IST by default).
  Adjust `TZ_OFFSET_MINUTES` in `.env` if not.
- `.env` and `.state.json` are git-ignored (they hold the secret and local state).
- This bridge does not modify the app. If you later want the device to push directly
  (ADMS/Push mode) instead of being polled, that needs a different endpoint in the
  app — ask before going that route.
