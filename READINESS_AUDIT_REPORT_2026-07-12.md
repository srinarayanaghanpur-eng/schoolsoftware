# School ERP — Readiness Audit Report (2026-07-12)

> Honesty note per instructions: I only mark something as "passed" if I actually
> executed it and saw the output. Where the sandbox prevented execution, it is
> labelled **NOT RUN — BLOCKED**, not "passing."

---

## 0. Environment constraint (must read first)

The build/test verification you asked for could **not** be completed in this
environment. Reasons, with evidence:

- The repo lives on a **OneDrive-synced path**, where `npm install` never
  populated `node_modules` (stayed at 0 bytes) due to sync/fsync contention.
- I copied the repo to a **local path** (`/tmp/erp`, off OneDrive) and installed
  there. Install **stalled three times**: the sandbox routes package downloads
  through a throttled proxy (~18–21 s per tarball, observed in npm's debug log),
  and each attempt hung mid-resolution with `node_modules` incomplete
  (~1,615 of the required packages) and `tsc` never becoming available.
- Playwright e2e also requires downloading browser binaries + running the
  Firebase emulator (Java) — not feasible under the same proxy/disk limits.

Consequence: `typecheck:web`, `build:web`, and the e2e/integration suites were
**not executed**. Only the standalone unit test (no dependencies) and static
tooling ran.

---

## 1. Exact commands executed

```
# repo relocation off OneDrive
rsync -a --exclude node_modules --exclude .next --exclude .git \
  /…/ATTENDANCE/ /tmp/erp/                       # OK (102 MB)

# dependency install (three attempts)
npm install --legacy-peer-deps                    # STALLED (postinstall hang)
npm install --legacy-peer-deps --ignore-scripts --no-audit --no-fund
                                                  # STALLED (proxy ~20s/pkg)
npm install --legacy-peer-deps --ignore-scripts --fetch-timeout=45000 \
  --fetch-retries=6 --prefer-offline              # STALLED at resolution

# standalone unit test (auto-installs tsx, no repo deps needed)
npx tsx tests/unit/finance-aggregation.test.ts    # PASSED 15/15

# repo's own static auth checker
node scripts/check-admin-api-auth.js              # PASSED (after fix)
```

## 2. Typecheck result

**NOT RUN — BLOCKED.** `npm run typecheck:web` requires a completed install; the
install never finished in this environment. No typecheck output can be honestly
reported.

## 3. Production-build result

**NOT RUN — BLOCKED.** Same reason. `npm run build:web` was not executed.

## 4. Test totals

| Suite | Result |
|---|---|
| `tests/unit/finance-aggregation.test.ts` | **15 passed, 0 failed** (executed) |
| Unit (rest) / integration / Playwright e2e | **NOT RUN — BLOCKED** (deps/emulator/browsers unavailable) |

Executed unit output included the documented example:
Cash ₹52,800 + Online ₹13,000 + UPI ₹8,000 = **₹73,800**.

## 5. Files changed (this session)

- `apps/web/components/finance/ResponsiveFinanceTable.tsx` — `rowKey(row, index)`.
- `apps/web/app/admin/finance/page.tsx` — unique transaction row key.
- `apps/web/components/SyncStatusBanner.tsx` — route calls now use `adminApiRequest()`.
- `APP_READINESS_AUDIT_2026-07-12.md`, `READINESS_AUDIT_REPORT_2026-07-12.md` — reports.

No route logic was rewritten this session, because I could not compile-verify
such changes and refuse to ship unverified edits into a live finance system.

## 6. Bugs found and root causes

1. **Duplicate React keys — Recent Transactions.** Root cause: `rowKey` built
   from `date-description-amount`, which is not unique when two payments share
   those values; `ResponsiveFinanceTable` mapped rows without an index fallback.
   Fix: thread `index` into the key. (Verified by logic; not compiled.)

2. **Unauthenticated admin API calls — SyncStatusBanner.** Root cause: raw
   `fetch("/api/admin/sync/…")` bypassed the app's `adminApiRequest()` auth
   wrapper, so the sync-status poll and "Rebuild Now" button would 401 against
   protected routes → banner silently broken. Fix: route both through
   `adminApiRequest()`. **Verified**: `scripts/check-admin-api-auth.js` now
   reports "No unauthenticated /api/admin fetch calls found."

3. **(Confirmed already-fixed from prior session)** `feeService.syncStudentFeeData`
   previously wrote `totalFeeDue` instead of `totalFeesDue`; verified the current
   code writes `totalFeesDue`. The remaining `totalFeeDue` occurrences are a
   legitimate report-layer DTO field, not the bug.

## 7. Firestore reads — analysis (NOT yet reduced in code this session)

**18 routes read up to 1,000–5,000 docs per request.** None were rewritten this
session (unverifiable without a working build). Recommended targeted fixes and
rough before/after per request (assuming a mid-size school, ~1–3k payments/yr):

| Route | Now | Recommended | Est. reads: before → after |
|---|---|---|---|
| `reports/monthly-collection` | `limit(5000)` full scan, sum in memory | 12× Firestore `AggregateField.sum`/`count` per month, or a `monthly_summaries` aggregate doc | ~1,500 → ~12 (or 1) |
| `exams/[id]/marks` | `limit(5000)` | cursor pagination (page size 100) + on-demand | ~5,000 → ~100/page |
| `salary` | 2× `limit(5000)` attendance + others | month-bounded aggregate docs per teacher | ~10,000 → ~100 |
| finance `daily`/`summary`/`profit-loss`/`trial-balance`/`branch-accounts` | 3–6× `limit(1000)` each | `AggregateField.sum` per collection over bounded date range | ~3–6k → ~6–30 |
| finance `defaulters`/`dues`/`receivables` | `limit(1000)` on `studentFeeSummaries` | cursor pagination + count aggregate | ~1,000 → ~50/page + 1 |
| `reports/dashboard-stats`, `payment-mode`, `user-wise`, `fee-reminder-dashboard`, `gps-settings` | `limit(1000)` | aggregate queries / bounded ranges / cached summary | ~1,000 → tens |

Correctness guard to add alongside: a unit test asserting the aggregate/paginated
total equals the full-scan total on a fixture (pattern already established in
`finance-aggregation.test.ts`).

Existing mitigation (prior session): `finance/dashboard` has a 60 s in-memory
response cache with `?refresh=1` bypass — keep and extend this pattern.

## 8. Remaining risks and limitations

- **No compile/build verification** performed here — the single biggest gap.
  Any claim of "ready" is unsupported until `typecheck:web` and `build:web` pass
  on a machine with a normal network.
- **e2e/integration untested** in this environment.
- Firestore read reduction is **designed but not implemented** in code.
- Modules requested for deep audit (auth/Remember-Me logout, RBAC per role,
  admissions, fee/committed-fee/concessions/advances, 3-receipts-per-page print,
  attendance check-in/out & working hours, payroll late-to-CL & part-time,
  exams/marks/report-cards, expenses/vouchers, parent portal, transport/bus
  finance, academic-year switching, offline sync) were **not deeply audited** —
  a green typecheck+build is the prerequisite signal and it isn't available yet.
- No ESLint config was added (would need install to run `eslint` meaningfully).

## 9. Verdict

**Not ready.**

Not because confirmed defects make it unusable, but because readiness **cannot be
certified**: compilation, production build, and the full test suites were never
successfully executed in this environment, and the requested deep module audits
depend on that foundation. Two real bugs were found and fixed (one auth bug
verified via the repo's own checker), and the finance aggregation unit tests
pass — but that is far short of production certification.

**To move forward:** on a normal local machine (repo outside OneDrive, unthrottled
network) run `npm install --legacy-peer-deps`, then `npm run typecheck:web` and
`npm run build:web`, paste the output back, and I will fix errors and proceed
through the module audit and the Firestore-reduction implementation with the
correctness tests described above.
