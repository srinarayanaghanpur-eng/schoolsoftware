# Performance Audit & Optimization — 6 July 2026

## Audit summary

Good news first: most server API routes were already well optimized from earlier passes — students list uses cursor pagination + aggregate counts, dashboard-stats and finance dashboard use aggregate/sum queries, finance reports (ledger, cash book, trial balance, profit-loss, daily, dues, defaulters) all have date filters + `limit()`, and there is quota-pause handling (`firebaseErrors.ts`) and read logging (`firestoreReadLogger.ts`).

The remaining problems were all on the **client/data-layer side**:

1. **`lib/adminApiClient.ts`** — every admin/portal page fetches through this, and it had **no caching, no dedupe, no offline fallback**. Every navigation refetched everything; two components asking for the same data made two calls; a quota/network failure produced a blank screen.
2. **No Firestore offline persistence** — `packages/shared/src/firebase/client.ts` used plain `getFirestore`, so nothing survived reloads or outages.
3. **`lib/feeService.ts`** — three functions read **entire collections** client-side: `getDashboardStats()` read ALL students + ALL payments (~1,500–3,000 reads/call), `getFeeDueStudents()` and `getFullyPaidStudents()` read all students then filtered in JS. (Currently unused/dead code, but a live grenade if ever wired up.)
4. **`app/admin/dashboard/page.tsx`** — `force-dynamic` server component with no cache: every visit re-ran 6 aggregates + 3 list queries; the week-attendance query had **no limit**.
5. **No visible offline status** anywhere in the UI.

## Files changed

| File | Change |
|---|---|
| `apps/web/lib/adminApiClient.ts` | Rewritten: 30s SWR memory cache for GETs, in-flight dedupe, localStorage stale fallback (24h) on offline/429/5xx, auto cache invalidation after mutations. API unchanged — all existing callers benefit with zero page edits. |
| `packages/shared/src/firebase/client.ts` | Firestore IndexedDB offline persistence (`persistentLocalCache` + multi-tab), browser-only guard so SSR and the Expo app are unaffected. |
| `apps/web/lib/feeService.ts` | `getDashboardStats` bounded (limit 1000) + payments now date-filtered at Firestore level; `getFeeDueStudents` → `where('totalFeesDue','>',t) + orderBy + limit(200)`; `getFullyPaidStudents` → `where('totalFeesDue','==',0) + limit(500)`. |
| `apps/web/app/admin/dashboard/page.tsx` | 60s server-side TTL cache around `loadDashboard()`; week-attendance query bounded with `limit(2000)`. |
| `apps/web/components/AppShell.tsx` | Global `OfflineBanner` ("Offline — showing saved data…") shown app-wide when the browser loses connectivity. |

## Estimated Firebase reads, before → after

| Page / action | Before | After |
|---|---|---|
| Admin dashboard, repeat visits within 60s | ~6 aggregates + up to ∞ attendance docs + 6 list docs per visit | **0** (server TTL cache); first visit bounded ≤ ~2,015 |
| Any admin list page, re-navigation within 30s | full refetch (25–500 doc reads) | **0** (client memory cache) |
| Two components fetching same endpoint | 2× reads | **1×** (dedupe) |
| Quota exhausted / offline | error → blank page | **0 reads, cached data shown** |
| `feeService.getDashboardStats` (if ever used) | ~1,500–3,000+ (all students + all payments) | ≤ ~1,060, date-filtered |
| `getFeeDueStudents` | all students (~1,000) | ≤ 200 |
| `getFullyPaidStudents` | all students (~1,000) | ≤ 500 |

Combined with the already-optimized API routes, day-to-day admin usage should drop **60–90% of repeated reads**, and the app no longer has any unbounded read path.

## Required Firestore indexes

No **new** composite indexes are required by these changes:
- `payments(createdAt range)` and `students(totalFeesDue)` are single-field (auto-indexed).
- Existing composite indexes for finance routes (`payments status+createdAt`, `expenses status+createdAt`, `salary_reports paid+paidAt`, `studentFeeSummaries dueAmount+filters`) are unchanged. If any of those were never deployed, the routes already degrade gracefully (`.catch(() => null)`), but deploy them from the Firebase console error links for full data.

## Risks / remaining issues

- **Cached GET responses are shared object references.** If a page mutates a response object in place, another consumer could see the mutation. Pages that copy data into state (the normal pattern here) are unaffected.
- **30s staleness on GETs.** After saving, `adminApiRequest` auto-invalidates the cache on any mutation, so save→list flows stay fresh. Cross-tab staleness is possible for up to 30s.
- **Offline writes are NOT queued.** Reads fall back to cache; mutations still fail fast when offline (deliberate — queueing fee payments/receipts risks duplicate receipts on sync; a safe queue needs server-side idempotency keys on the payment endpoints first — recommended next step).
- **Typecheck not run** — the local sandbox couldn't start (your machine's disk is full). Run `npm run typecheck` in `apps/web` before deploying.
- Dashboard 60s cache is per server instance; on serverless deploys with many cold instances the benefit shrinks (still correct, never wrong).

## How to test

1. **Caching/dedupe:** open DevTools → Network. Visit Students, navigate to Dashboard, back to Students within 30s → no second `/api/admin/students` request. After adding a student, list refetches (cache invalidated).
2. **Offline fallback:** load Dashboard, then DevTools → Network → Offline, reload navigation between pages → amber "Offline — showing saved data" banner appears, pages show last data instead of erroring.
3. **Persistence:** Application tab → IndexedDB → look for `firestore/...` database after login.
4. **Quota fallback:** endpoints returning 429 (quota) now serve the last good localStorage copy instead of "Request failed".
5. **Dashboard cache:** visit `/admin/dashboard` twice within a minute; server logs show Firestore aggregate reads only on the first visit.
6. **feeService:** unused in the app today; unit-test bounds if you wire it up.

## Recommended next steps (not done, would need your sign-off)

1. Idempotency keys on payment/receipt POST endpoints, then a safe offline write queue for attendance marking only.
2. Virtualized lists (e.g. `@tanstack/react-virtual`) for the students table beyond ~200 visible rows.
3. Replace `xlsx` static imports with dynamic `import()` in report pages to cut bundle size (`xlsx` is ~400KB).
4. Move the Expo/mobile app to `initializeFirestore` with RN persistence if offline matters there too.
