# Desktop Application Plan (Electron)

Status: Shell capabilities started — offline/hardware/updater work remains blocked until the core readiness gate in section 2.1 passes
Owner: Engineering
Last updated: 2026-11-04

## 1. Purpose

The desktop app is a thin Electron shell around the same Next.js web app. Shell
capabilities now include hosted-mode loading and native print/PDF; the remaining
work is what makes the desktop build earn its place: offline operation, native
printing at scale, local hardware, and safe self-updates.

The guiding rule is **one codebase with progressive enhancement**. The web app
remains the baseline. Desktop detects a bridge and unlocks extra capabilities.
There is no forked UI and no duplicated business logic.

## 2. Current state

| Component | Reality today |
|---|---|
| `apps/desktop/main.js` | Packaged builds default to **hosted mode** (`https://schoolsoftware-two.vercel.app`). `ERP_APP_URL` overrides the URL; `ERP_APP_URL=local` forces the bundled server. Development falls back to the Next.js standalone server on `127.0.0.1:3456` (scans up to 50 ports), single-instance lock, splash and error pages, loads runtime env from `userData` |
| `apps/desktop/preload.js` | Exposes `window.narayana` (`app.info`, `app.capabilities`, `print.current`, `print.pdf`); `window.electronAPI` kept as a deprecated alias |
| `apps/web/lib/desktopBridge.ts` | Typed capability detection; native print/PDF when the bridge exists, browser fallback otherwise |
| `apps/desktop/scripts/build-web.js` | Rebuilds web with `STANDALONE=true`, copies standalone + static + public into `resources/`, refuses to package `.env*` files (local-server fallback only) |
| `apps/desktop/scripts/build-installer.js` | Builds the installer from a temporary staging copy outside the workspace, so electron-builder cannot prune the repo's dev dependencies |
| `apps/web/lib/adminApiClient.ts` | 30s memory cache, in-flight dedupe, localStorage stale fallback |
| `packages/shared/src/firebase/client.ts` | Firestore `persistentLocalCache` (browser only) |
| `apps/web/public/sw.js` | Attendance offline queue exists but is known to target an endpoint that may not exist; verify before reuse |
| `apps/web/app/api/admin/backup/route.ts` | Server-side backup endpoint |

Net effect: native print and PDF export are wired for the desktop shell. Offline writes, biometrics, auto-update, and secure secret storage are still pending.

Hosted mode is the default for packaged builds. `ERP_APP_URL` can point at a different deployment, and `ERP_APP_URL=local` forces the bundled local server. The local-server fallback remains for development and offline experiments.

### 2.1 Precondition: core product readiness

The desktop app is a wrapper around the same web application. It inherits every
defect in the core. Building desktop features before the core is production-ready
means testing, debugging, and repackaging the same bugs twice, and shipping a
faster shell around unfinished workflows.

Current audit verdict is **Partially Functional**, not production-ready
(`docs/audit/ERP-AUDIT-SUMMARY.md`). The gate is defined and tracked in
`docs/CORE_READINESS_PLAN.md` (gates C0-C7). Desktop work is therefore gated on
the following, all of which must be true:

| # | Gate criterion | Evidence |
|---|---|---|
| G1 | `typecheck:web`, `build:web`, unit tests, and Playwright suite pass on a normal machine | CI green on `main`, output pasted into the readiness record |
| G2 | All Phase 0 security and data-safety items closed | `docs/audit/AUDIT-PROGRESS.md` Phase 0, plus `check:admin-api-auth` |
| G3 | No open P0 financial-integrity issues (receipt cancel, concession recalc, dual fee-balance stores, year-end carry-forward) | Written sign-off per item |
| G4 | Core academic scope decided and delivered or explicitly deferred by the owner (student attendance was dropped by owner decision — record it) | Decision log |
| G5 | Onboarding path exists (bulk import of students, parents, fee assignment) | Working import with a real sample file |
| G6 | Fee-reminder scheduler and provider credentials wired, or formally deferred | Cron run evidence or deferral note |
| G7 | Manual go-live actions completed: rotated service-account key and API key, rotated admin passwords, `firestore.rules` deployed, `CRON_SECRET` set, TTL policy on `rate_limits` | Operator checklist in `NarayanaOS-Production-Readiness-Report.md` section 9 |
| G8 | UAT with real school data on a staging deploy, including one full fee cycle and one full attendance cycle | UAT sign-off |

If any gate fails, desktop work does not start. Re-baseline this plan at that
point, because the core may have changed shape.

## 3. Locked decisions

| Area | Decision |
|---|---|
| Tenancy | Single school now. Keep tenant boundaries clean (config-driven, no hardcoded school IDs) so a multi-school product is possible later. No multi-tenant UX in v1. |
| Offline writes | Attendance only. Fee collection stays online-only and fails fast to avoid duplicate receipts. |
| Updates | `electron-updater` against a release feed, plus a manual NSIS installer as fallback. |
| First hardware | Biometric device, ingested through a local listener. |
| Platform | Windows 10/11 x64 (NSIS target already configured). macOS and Linux are out of scope. |
| Business logic | Stays server-side. Electron only adds local I/O, storage, and device access. |

## 4. Scope

### In scope for v1

- Offline attendance capture with exactly-once sync.
- Silent printing of receipts, report cards, and hall tickets, plus PDF export.
- Local biometric ingestion that works without cloud reachability.
- Auto-update with manual fallback.
- Secrets moved out of plaintext files into the OS credential store.

### Non-goals

- A separate desktop UI or a fork of the web pages.
- Client-side business logic, fee calculation, or authorization decisions.
- Offline fee collection or any money-mutating offline write.
- Multi-tenant switching or tenant onboarding.
- macOS/Linux builds.

## 5. Architecture

### 5.1 Process model

```
Renderer (Next.js UI, sandboxed)
        |  window.narayana.*  (contextBridge)
        v
Preload (allowlisted IPC only)
        |  ipcRenderer.invoke
        v
Main process (Node)
   |- SQLite store (attendance queue + cache)
   |- Sync engine
   |- Print service
   |- Biometric listener
   |- Update service
   |- Next.js standalone server (child process)
```

`contextIsolation: true` and `nodeIntegration: false` remain mandatory. No remote
content is loaded into a privileged window.

### 5.2 ADR-1: IPC contract

The renderer only ever sees a namespaced, allowlisted API. Every channel is
`ipcRenderer.invoke` on the renderer side and `ipcMain.handle` in main. Every
payload is validated with zod in main before use. Errors are returned as
structured results, never thrown across the bridge.

Proposed surface:

```
app.info()                    -> { version, platform, isPackaged }
app.capabilities()            -> { printing, offline, biometric, updater }
attendance.queue(records[])   -> { queued, rejected[] }
attendance.pending()          -> records[]
attendance.clear(id[])        -> { cleared }
sync.status()                 -> { online, pending, lastSyncAt, lastError }
sync.flush()                  -> { flushed, failed }
print.receipt(payload)        -> { ok } | { error }
print.pdf(payload)            -> { path }
backup.run()                  -> { path }
device.biometric.status()     -> { listening, port, lastEventAt }
updates.check()               -> { available, version }
```

Rules:

- One channel per action. No generic `eval`/`execute` channel.
- The renderer never passes file paths that main will read or write; main
  resolves paths from a fixed allowlist or an OS dialog.
- Keep `window.electronAPI` as a deprecated alias until no code depends on it.

### 5.3 ADR-2: Local store

SQLite via `better-sqlite3`, opened in the main process and stored under
`app.getPath("userData")`. The renderer never touches the database directly.

```
attendance_queue(
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  student_id       TEXT NOT NULL,
  class_id         TEXT NOT NULL,
  date             TEXT NOT NULL,
  status           TEXT NOT NULL,
  marked_by        TEXT NOT NULL,
  marked_at        TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  sync_state       TEXT NOT NULL,   -- pending | syncing | failed | synced
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT
)

attendance_cache(  -- read-side mirror for offline display
  tenant_id, student_id, date, status, updated_at,
  PRIMARY KEY (tenant_id, student_id, date)
)

sync_meta(key TEXT PRIMARY KEY, value TEXT)
```

Notes:

- `better-sqlite3` is a native module and must be rebuilt for Electron 33. This
  is validated in M0 before anything else is built on it.
- Index on `(sync_state, date)` for fast pending scans.
- Database file permissions inherit the OS user profile. Field-level encryption
  is not in v1; revisit if devices are shared.

### 5.4 ADR-3: Sync and conflict rules

- The queue flushes on reconnect, on app start, and on a short timer while
  online.
- Records are sent in batches to the existing attendance write endpoint. The
  batch endpoint and its idempotency behaviour must be verified in M1 before
  implementation; the service worker's queue is not trusted as-is.
- `idempotency_key` is derived from `(tenant_id, student_id, date, marked_by)`.
  Retries reuse the same key, so a flush is exactly-once.
- Conflict handling:
  - If the server record was last edited by an admin after the local
    `marked_at`, the server value wins and the local record is marked
    `failed` with a reason for admin review.
  - Otherwise the local record is applied and an audit entry is written.
  - A record is never silently overwritten.
- Fee payments are explicitly excluded from the queue. The existing
  "fail fast when offline" behaviour stays.
- Flush is bounded (batch size and attempt cap) so a bad record cannot block
  the queue indefinitely.

### 5.5 ADR-4: Secrets

The Firebase service-account key currently lives in plaintext at
`%APPDATA%/Sri Narayana ERP/.env.local`. Replace with Windows Credential
Manager via `keytar` in the main process:

1. On first run, if the credential is absent and a legacy `.env.local` exists,
   import it into the credential store and delete the file.
2. The main process injects credentials into the server child process
   environment at spawn time.
3. The `.env.local` path remains supported for development only.

This closes an exposure already called out in the production readiness report.

### 5.6 ADR-5: Updates

- `electron-updater` with a hosted release feed (generic provider or GitHub
  Releases).
- **Code signing is a hard dependency.** Unsigned auto-updates will be blocked
  or warned on Windows. Acquire the certificate before M4.
- Manual fallback: the NSIS installer remains downloadable and installable.
- Update checks are background and non-blocking; the app never auto-restarts
  while an attendance queue is non-empty.
- Rollback: keep the previous installer version available for reinstall.

#### Signing identity

`apps/desktop/package.json` declares `author` and `win.publisherName` as
**Ananth Technologies**. That metadata alone does not change the Windows UAC or
SmartScreen publisher label; the label comes from the Authenticode certificate
subject.

To make Windows show **Ananth Technologies**:

1. Obtain an OV or EV Windows code-signing certificate issued to the legal
   entity `Ananth Technologies` (EV gives immediate SmartScreen reputation).
2. Export it as `.pfx` (or use Azure Trusted Signing / a hardware token).
3. Set `CSC_LINK` to the certificate path (or base64) and `CSC_KEY_PASSWORD`,
   or configure `win.certificateFile` / `win.certificatePassword`.
4. Rebuild with `npm run dist:desktop`.

A self-signed certificate can show the name on a managed PC only after the
certificate is installed in Trusted Root and Trusted Publishers. It is not a
substitute for a publicly trusted certificate.

### 5.7 Printing

- Silent print to the default or a selected printer from the main process.
- Child `BrowserWindow` renders the document, then `webContents.print()` or
  `printToPDF()`.
- Targets: fee receipts, report cards, hall tickets, ID cards.
- Desktop-only. The web app keeps `window.print()`.
- Batch mode must not open dialogs and must report per-document failures.

### 5.8 Biometric ingestion

- Main process runs a loopback HTTP listener that accepts the device payload and
  forwards it to `/api/biometric/ingest` when online, or queues it locally when
  offline.
- Exact protocol (push HTTP vs. SDK polling) depends on the device model and is
  an open item.
- Listener binds to `127.0.0.1` only, never `0.0.0.0`.
- Antivirus and firewall behaviour on school images must be tested early.

## 6. Milestones

| M | Deliverable | Acceptance criteria |
|---|---|---|
| **M0** (2-3 days) | IPC bridge with zod validation, SQLite proof of concept, Electron Playwright project | `app.info` and a SQLite write/read round-trip pass in an Electron E2E test; native module builds under Electron 33 |
| **M1** (2-3 weeks) | Offline attendance queue, sync engine, conflict handling, auto-backup | A full school day offline captures attendance; on reconnect it flushes exactly once; kill-network and double-flush tests pass; no duplicate records |
| **M2** (1 week, parallel to M1) | Silent printing and PDF export | 50 receipts batch-print with zero dialogs; PDFs written to a chosen folder; per-document failure reporting |
| **M3** (1-2 weeks) | Biometric local listener wired through the queue | Device ingest succeeds while the internet is down and syncs later |
| **M4** (1-2 weeks) | Auto-update, credential store, tray/kiosk, licensing hooks | Update from vN to vN+1 succeeds; no plaintext key on disk; queue blocks restart during sync |

Suggested release order: `core readiness gate -> M0 -> M2 (visible win) -> M1 (reliability) -> M3 -> M4`.

## 7. Test strategy

- **Unit:** sync/conflict logic, idempotency key derivation, queue state
  transitions.
- **Electron E2E:** new Playwright project launching the packaged app, covering
  the IPC contract and the offline drill.
- **Offline drill:** start online, go offline, mark attendance for a full day,
  reconnect, assert exactly one server record per student per day.
- **Failure drills:** kill the server mid-flush, force a 500, force a timeout,
  corrupt a queued record.
- **Printing:** batch of 50, missing printer, printer offline.
- **Update:** vN to vN+1, interrupted update, rollback reinstall.
- **Security:** IPC fuzzing with invalid payloads, verify no filesystem escape,
  verify credentials never reach the renderer.

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| `better-sqlite3` ABI mismatch under electron-builder | Blocks M1 | Prove it in M0; pin Electron 33 |
| No code-signing certificate | Blocks auto-update | Acquire early; manual installer fallback |
| Duplicate attendance on retry | Data integrity | Idempotency keys + exactly-once E2E |
| Attendance batch endpoint does not exist / differs | Rework | Verify in M1 before implementation |
| Antivirus blocks loopback listener | M3 blocked on school PCs | Test on school images early |
| Biometric protocol unknown | M3 estimate uncertain | Open item; resolve before M3 |
| Key remains on disk until M4 | Security | Pull keychain work forward into M1 if feasible |
| Disk growth from offline cache | Operational | Retention policy + pruning in M1 |

## 9. Open items

1. Biometric device make/model and protocol (HTTP push vs. SDK/poll).
2. Printer model(s); whether thermal printing and cash drawer are v1.
3. Code-signing certificate availability and lead time.
4. Number of machines and who holds admin rights.
5. Windows version mix (10 vs. 11) across school machines.
6. Whether devices are shared between staff (affects local data encryption).
7. Release feed hosting choice (GitHub Releases vs. generic HTTPS host).

## 10. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-31 | Desktop work is gated on core product readiness | The desktop app wraps the web app and inherits its defects; the core is currently Partially Functional |
| 2026-10-31 | Single school now, multi-tenant-ready later | Avoid premature tenancy work while keeping boundaries clean |
| 2026-10-31 | Offline writes limited to attendance | Money offline risks duplicate receipts and audit gaps |
| 2026-10-31 | Auto-update plus manual fallback | Some school PCs will not reach the update feed |
| 2026-10-31 | Biometric first hardware | Existing ingest endpoint and clear school need |

## 11. Change control

Any change to the locked decisions in section 3 requires an update to this
document and an entry in the decision log. Implementation must not start on a
milestone whose open items are unresolved, and no milestone may start before the
readiness gate in section 2.1 passes.
