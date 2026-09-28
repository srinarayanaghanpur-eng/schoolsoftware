# NarayanaOS — Production Readiness Report

**Date:** 2026-09-28
**Commit verified:** `ea9be7a` (main, synced with origin)
**Workflow:** Automated QA (`.github/workflows/qa.yml`) — 19 steps, zero `|| true` escapes
**Verdict:** **READY for production deployment**, conditional on the manual security actions in §9 being completed before go-live.

---

## 1. Executive Summary

This engagement took NarayanaOS from an unaudited state through six stages:
audit → critical security/data fixes → test & CI infrastructure → code quality →
performance → final verification. All work was done as scoped, verified commits
on `main` (18 commits this session, each pushed and gated by CI).

| Area | Before | After |
|---|---|---|
| Privilege escalation paths | 4 (stale claims, open role grants, ungated cron, desktop key packaging) | 0 — all gated + audited |
| Portal IDOR | 1 (messages read any conversation) | 0 — student-linked ownership checks |
| Unit tests | 0 | **25/25 passing** |
| CI quality gates | broken (`|| true` everywhere) | **19 steps, all enforced, green** |
| Lint | none | ESLint `next/core-web-vitals`, **57 warnings / 0 errors** |
| `as any` casts (web) | 14 | **0** |
| Largest client chunk | 3.66 MB (recharts) + 14 MB icon route | **404 KB** (xlsx, lazy-only) |
| N+1 Firestore loops | 6 hot paths (up to ~1,500 round-trips per cron run) | batched/chunked (≤ ~25 round-trips) |
| Unbounded queries | 9 endpoints | all bounded (limit / count aggregate / paged) |

---

## 2. Stage A — Audit (read-only)

Four parallel sweeps established the baseline:

1. **Security**: privilege escalation via stale `token.role` custom claims; `POST /api/admin/users`
   granting any role including `super_admin`; unauthenticated cron endpoints; plaintext service-account
   key inside `apps/desktop` packaging; secrets in `scripts/create-users.mjs`; portal messages IDOR;
   missing fee order/confirm permission gates; missing payload caps; client-controlled rate limiting.
2. **Data integrity**: non-atomic approval transitions (promotions, salaries); balance revalidation
   outside the write transaction; missing audit logs on destructive operations (student DELETE,
   bulk-delete, salary PATCH, teacher DELETE); attendance check-in bug in mobile.
3. **Tests/CI**: zero unit tests; workflow masked failures with `|| true`; build depended on
   Firebase env vars at build time (would fail in CI); no e2e or hydration guard.
4. **Code quality**: 6 ESLint-equivalent errors (incl. a real `rules-of-hooks` bug in `usePopup`),
   25 ungated `console.log`, 14 `as any`, one 2,205-line page file, dead selector code (~430 lines),
   heavyweight client imports (recharts, qrcode, xlsx reachable from the root barrel).

---

## 3. Stage B — Security & Data Integrity (6 commits)

| Commit | Summary |
|---|---|
| `ff856b8` | `super_admin`-only role grants; cron auth (`isAuthorizedCronCall` + `CRON_SECRET`); firestore.rules fixes; desktop env packaging stripped of keys |
| `3b93398` | Roles PATCH locked to `super_admin`; promotions queries chunked (500); portal messages IDOR fix; API key masking in logs; mobile attendance type fix |
| `598f790` + `fe88800` | Fees order/confirm gated on `fees.create`; approval transitions made atomic inside transactions; legacy payments revalidate balance *in-transaction* |
| `8dc60f8` | 13 files migrated from stale custom-claim checks to canonical `resolveRole()`; `requireAdminOrPrincipal` added; staff view opened to principal |
| `4ec5f05` | Firestore-backed rate limiter (server-authoritative) wired to 5 hot endpoints; `enforceBodyLimit` 413 caps on students & bulk-upload |
| `54c7552` | Idempotent student/parent creation (dedupe on key fields); audit logs added for destructive ops; `create-users.mjs` passwords moved to env vars; parent actorRole → `resolveRole` |

---

## 4. Stage C — Tests & CI (1 commit)

**`7772e6c`** — the QA foundation:

- `scripts/run-tests.mjs` (`node --import tsx --test`) + 3 test files (RBAC matrix, schema validation,
  Firestore sanitizer) → **25 tests, 8 suites**.
- Playwright smoke suite: 6 specs, mobile skipped, 180s webServer timeout.
- `qa.yml` rewritten: 19 explicit steps — install (`npm ci --legacy-peer-deps`), lint, typecheck ×2,
  unit tests, build (with dummy `NEXT_PUBLIC_*` env to prove env-independence), playwright, hydration guard.
  **No step uses `|| true`.**
- 5 API files converted to lazy `adminDb()` so the build works with empty env; `promotions/history`
  marked `force-dynamic`. CI env has no Firebase credentials — build verified green both with and without env.

---

## 5. Stage D — Code Quality (4 commits)

| Commit | Summary |
|---|---|
| `0ba115f` | ESLint added; 6 errors fixed (real hooks bug in `usePopup()`); lint gate in CI |
| `4689a91` | 25 ungated `console.log` removed (sw.js ×13, serviceWorkerUtils ×10, OfflineStatusIndicator, AdminDashboardComponents); intentional dev-gated/perf logs retained |
| `0ad9a62` | All **14 `as any`** eliminated: `in`-narrowing type guards, typed intersection casts, `Partial<Record<Role, readonly Permission[]>>`, `Pick<DocumentSnapshot,...>` serialization, event-handler typing, direct `requestIdleCallback` |
| `dfb871c` | `students/[classId]/page.tsx` split **2,205 → 1,248 lines**; new `student-form-modal.tsx` (534) + `section-manager-modal.tsx` (173); ~430 lines dead selector code removed (zero repo-wide references verified) |

---

## 6. Stage E — Performance (5 commits)

### E1 — Bundle (`32e6322`, `f069251`)
- Deleted `app/icon.png` (**14.2 MB**, zero references; metadata.icons already points at the JPG logo).
- `portal/exams`: recharts now `next/dynamic` (`ssr: false`) via new `ExamsPerformanceChart.tsx` —
  **3.66 MB `8592` chunk removed from initial load**.
- `UpiQr`: `qrcode` (239 KB) moved to a dynamic import inside the effect.
- `LazyDashboardCharts`: pointless `dynamic()` wrappers replaced with static re-exports.
- Root barrel `export * from ".../reportExportService"` removed — **xlsx (404 KB) is no longer
  reachable from every entry that imports `@sri-narayana/shared`** (all 41 real importers already
  use deep paths).

### E2 — N+1 query loops (`1c947a8`)
- **cron/reminder queue**: eligibility checks parallelised in chunks of 25 (same query shapes — no new
  indexes), writes committed in batches of 400 → ~25 round-trips instead of ~1,500 per run.
- **approvalEngine (promotion)**: per-record reads replaced with chunked `db.getAll` (100/batch),
  two-phase (promotions → only the students needing balance carry-forward).
- **fee-reminder PUT**: deduplicated ids, capped at 500, committed as batched `update`s (400/batch).
- **bulk-upload book prices**: one preload query per academic year (Map lookup) instead of one query per row.
- **promotions audit logs**: serial `await` loop → `Promise.all` chunks of 20.
- **students page QR**: 50 serial QR encodes on every fetch removed entirely — QR now generated
  on demand for the open modal (with cancellation), buttons/menu always visible, modal shows
  a "Generating…" placeholder; dead `printStudent` state removed.

### E3 — Unbounded queries & client (`b16320d`, `ea9be7a`)
- `timetable` GET → `.limit(500)`; `transport/assignments` → `.limit(500)`;
  `portal/payments` → `.limit(200)`; `portal/exams` + `portal/summary` marks → `.limit(500)`;
  portal exams list → `.limit(200)` (all limit additions preserve existing query/index shapes).
- `ai/context`: teachers, classes, pending approvals converted from full-collection reads to
  `count()` aggregates (students by-class distribution kept as a lean `.select("class")` read — bounded by school size).
- **Homework DELETE & `clearAiCache`**: chunked paged deletes (400/batch) — fixes latent
  **500-operation batch-crash** if >500 submissions/cache entries existed.
- **report-card**: quadratic ranking (`marks.filter` + `ranked.find` per student → O(n²)) replaced
  with single-pass `Map` grouping + `rankByStudent` lookup (no result limit added — ranking needs all marks).
- **AppShell**: badge-poll effect no longer depends on `pathname` (was re-fetching on every navigation).
- **portal/exams**: in-flight fetches cancelled with `AbortController` on child switch/unmount.

---

## 7. Verification Evidence (final, commit `ea9be7a`)

| Gate | Command | Result |
|---|---|---|
| Web typecheck | `npx --workspace @sri-narayana/web tsc --noEmit` | **0 errors** |
| Mobile typecheck | `npm run typecheck --workspace @sri-narayana/mobile` | **0 errors** |
| Lint | `npm run lint --workspace @sri-narayana/web` | **57 warnings / 0 errors** (baseline held) |
| Unit tests | `npm test` (→ `scripts/run-tests.mjs`) | **25/25 pass, 8 suites, ~1.0s** |
| Production build | `next build` | **exit 0, 226/226 pages**, largest chunk 404 KB |
| Desktop syntax | `node --check apps/desktop/main.js` | **exit 0** |
| Git sync | `git rev-parse main origin/main` | both `ea9be7a` |
| CI (latest 4 runs) | GitHub Actions "Automated QA" | **all `success`** (incl. playwright e2e + hydration guard on `ea9be7a` and `b16320d`) |
| CI (this session) | 18 commits | every push gated; **0 red runs observed** |

Lint warning composition (pre-existing backlog, none blocking):
44 × `react-hooks/exhaustive-deps`, 11 × `@next/next/no-img-element`,
1 × `@next/next/no-before-interactive-script-outside-document`, 1 × anonymous default export.

---

## 8. Architecture Notes (unchanged, verified)

- Roles: `super_admin, admin, principal, accountant, teacher, parent, settings_manager` —
  `resolveRole()` is canonical; `token.role` used for audit labels only.
- Auth helpers: `requireAdmin`, `requireAdminOrPrincipal`, `requireSuperAdmin`, `requirePermission`,
  `enforceBodyLimit`, `isAuthorizedCronCall`.
- Rate limiting is Firestore-backed and server-authoritative (client cannot bypass by clearing storage).
- CI runs with **no Firebase credentials**; client steps use dummy `NEXT_PUBLIC_FIREBASE_*`.

---

## 9. Manual Actions Required Before Go-Live ⚠️

These cannot be completed from code and **must** be done by the operator:

1. **Rotate the desktop service-account key** — the old JSON key was committed earlier in git history;
   deleting the file (`32e6322` era) does not invalidate it. Rotate in Firebase Console → Service accounts.
2. **Rotate the web Firebase API key** in `apps/web/.env.local` (also present in git history) and set
   Firebase App Check / HTTP referrer restrictions.
3. **Rotate admin passwords** created by `scripts/create-users.mjs` (plaintext passwords were in git
   history before `54c7552`). Also rotate any other credentials that appeared in history.
4. **Deploy `firestore.rules`** — the rules file was edited in `ff856b8` but Vercel/Firebase deploy
   rules are a separate operation. Verify with the Rules Playground.
5. **Set `CRON_SECRET`** (and the scheduler for `/api/cron/*`) in Vercel environment variables;
   confirm unauthenticated cron calls now return 401.
6. **Firestore TTL policy** on `rate_limits.expiresAt` (Console → Firestore → TTL) so the
   rate-limiter collection cannot grow unbounded.
7. **Desktop `.env.local`** must be provisioned at `%APPDATA%\Sri Narayana ERP\.env.local` on each
   machine — no secrets are packaged anymore by design.
8. **Decide `settings_manager` scope** — currently retains `[ALL]` by explicit decision; narrow if
   a least-privilege posture is required (this changes behaviour, so it was not done unilaterally).
9. **Post-deploy smoke test**: create user → login → student admission → fee receipt → parent portal
   (mobile + desktop), plus one `/api/cron/create-reminder-queue` run with a test `CRON_SECRET`.

## 10. Deferred Items (tracked, non-blocking)

- **Firestore composite index for report-card aggregation** — a future move to on-query aggregation
  would need an index; current in-process grouping is correct and bounded.
- **backup endpoint pagination** — full-collection reads on a rare, admin-only path.
- **ai/context students `byClass` distribution** — kept as a lean `.select()` read; could become
  per-class `count()` queries with a class list dependency.
- **portal pagination UX** — payments/marks are capped (200/500) rather than paginated.
- **`sync-ai-permissions`** — 90 sequential ops on a manual admin button (bounded, rare).
- **Audit log fragmentation** — `admin_audit_logs` vs `audit_logs` collections exist side by side.
- **Approval-effect outbox follow-up** — design item from Stage B notes.
- **57 ESLint warnings** — backlog in §7; all stylistic/hooks-depth, none blocking.
- **Promotion batch cap** — 500 records per approval decision (documented behaviour).

## 11. Known Risks / Limitations

- Rate limiting depends on Firestore availability (fails open on read error by design — availability
  over strictness; revisit if abuse becomes a concern).
- `adminApiRequest` retries once on auth-refresh; long-running server routes can still hit Vercel's
  function timeout under extreme load (cron route was the worst offender and is now ~60× fewer round-trips).
- Firestore Spark (free) plan: no SLA; scheduled TTL cleanup and quotas should be monitored.

---

*Report generated for NarayanaOS (Sri Narayana High School) production readiness, verified against
commit `ea9be7a` with CI run `36425812138` (success).*
