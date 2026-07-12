# App Readiness Audit — 2026-07-12

Scope: static code audit of the School ERP monorepo (`apps/web` Next.js + Firestore).
No production run/build was possible this session — see "Limitations."

## Bottom line

The app is in reasonable shape structurally: TypeScript `strict` is on, only 1 `TODO`
and 1 `@ts-ignore` across the web app, and the finance module now passes its unit tests
(15/15). Two real bugs were found and fixed this session. The main open risk is a set of
unbounded Firestore reads that can hit quota/cost under real data, plus an unverified full
typecheck because dependencies could not be installed over the OneDrive mount.

Verdict: **usable for the finance flows we fixed, but not yet certified "ready" app-wide** —
a clean `typecheck` + production build must pass first (blocked here on disk/deps, see below).

## Fixed this session

1. **Duplicate React keys in Recent Transactions** — `ResponsiveFinanceTable` now accepts
   `rowKey(row, index)` and passes the index in both desktop and mobile row maps;
   the finance page key is now `${date}-${description}-${amount}-${index}`. Removes the
   React duplicate-key warning and potential row render glitches.
   Files: `apps/web/components/finance/ResponsiveFinanceTable.tsx`,
   `apps/web/app/admin/finance/page.tsx`.

2. **Unauthenticated admin API calls in SyncStatusBanner** — `SyncStatusBanner.tsx` called
   `/api/admin/sync/status` and `/api/admin/sync/rebuild-dashboard-summary` with raw `fetch`,
   bypassing the app's auth wrapper. Against protected admin routes these would 401, so the
   sync banner / "Rebuild Now" button were effectively broken. Both now use
   `adminApiRequest()`. Verified with `scripts/check-admin-api-auth.js` → "No unauthenticated
   /api/admin fetch calls found."

## Verified good

- **Finance aggregation tests:** `npx tsx tests/unit/finance-aggregation.test.ts` → 15 passed,
  0 failed, including Cash ₹52,800 + Online ₹13,000 + UPI ₹8,000 = ₹73,800.
- **TypeScript config:** `strict: true` in `tsconfig.base.json`.
- **Code hygiene:** 1 TODO/FIXME, 1 `@ts-ignore`, 1 `dangerouslySetInnerHTML` across the web
  app — low technical debt on these markers.
- **`totalFeeDue` naming:** the report layer legitimately uses a `totalFeeDue` DTO field; the
  earlier critical bug (Firestore write) is confirmed fixed to `totalFeesDue` in `feeService.ts`.

## Open items (recommended before calling it "ready")

### High — verify it compiles & builds
- Run `npm run typecheck:web` and `npm run build:web` on a machine where deps install cleanly.
  This session could not: `npm install --legacy-peer-deps` did not populate `node_modules`
  over the OneDrive-synced folder (stayed at 0 bytes). Install on a local (non-OneDrive) path
  or move the repo off OneDrive for builds.

### Medium — unbounded / heavy Firestore reads (cost & quota risk)
Many endpoints fetch up to 1,000–5,000 docs per request with no cursor/pagination. Under real
data these drive read cost and the ~5k-reads complaint seen earlier. Highest exposure:
- `api/admin/exams/[id]/marks` — `limit(5000)`
- `api/admin/reports/monthly-collection` — `limit(5000)`
- `api/admin/salary` — two `limit(5000)` (attendance)
- The finance report family (`daily`, `summary`, `profit-loss`, `trial-balance`,
  `branch-accounts`, `defaulters`, `dues`, `receivables`) — `limit(1000)` each, several per call.
Recommend: add short-TTL caching (as already done on the finance dashboard route), aggregate
in Firestore where possible, and/or paginate.

### Low — cleanup
- Consider deleting the dead client-side `feeService.getDashboardStats` (reads up to ~4k docs
  if ever wired up).
- No ESLint config found in `apps/web`; adding one would catch key/hook issues automatically.

## Limitations of this audit
- No app run, no production build, no full `tsc` — dependency install failed over OneDrive.
- Firestore data was not inspected; logic correctness is judged from code + unit tests only.
- Modules other than finance (attendance, exams, RBAC, fee concessions, vouchers, bus finance)
  were scanned for patterns but not deeply reviewed. A green typecheck + build is the fastest
  next signal for those.
