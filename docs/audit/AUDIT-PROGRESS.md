# AUDIT PROGRESS

| Area | Inspection level | Report | Remaining work |
|---|---|---|---|
| Project structure, configs, auth infra | Read in full (`apiUtils`, `routeAccess`, package.json, firestore.rules partial) | 01 | Read full firestore.rules (only first 80 lines read), firebase.json, next.config, CI |
| Page inventory (108 pages) | Enumerated all; ~10 pages read/grepped in depth (payments, attendance, timetable, teacher dashboard, dashboard) | 02 | Per-page component/state audit for remaining ~95 pages |
| UI action map | Critical actions verified (fees, attendance, timetable, exams, salary) | 03 | Transport/inventory/library/hostel/finance sub-pages, notices, promotions buttons |
| Backend inventory (186 routes) | Enumerated all; read in full: `admin/payments` (GET+POST); collection usage grepped for all | 04 | Per-route table (auth helper, validation, response shape) for remaining ~180 routes; run `check:admin-api-auth` |
| API map | Key endpoints mapped | 05 | Cron secret check, biometric device auth, fees/confirm gateway verification, erase-data auth |
| Firestore map | Complete grep-based map of `apps/web` | 06 | `apps/mobile` collection usage; field-level schemas; subcollection scan (`doc().collection()` pattern) |
| Connection matrix | Done for all modules at structure level | 07 | Upgrade ◐ rows to ✅/🔴 with per-route reads |
| Role flows | Done from routeAccess + page evidence | 08 | AppShell menu list per role (read AppShell.tsx fully) |
| Module audit (40 modules) | Done | 09 | Verify flagged items: homework submission writer, salary_advances writer, concession recalc |
| Workflow traces A–G | Done | 10 | Runtime QA against emulator |
| UI/nav audit | Code-level | 11 | Hands-on click-through |
| Data consistency | Key transactions verified; 4 unsafe paths flagged | 12 | Read receipt-cancel route, concessions [id] route, salary route in full |
| Mock/placeholder | Grep of `app/` complete | 13 | Grep `components/`, `packages/`, mobile app |
| Gap analysis | Done | 14 | — |
| Readiness plan | Done | 15 | — |
| apps/mobile, apps/desktop, packages/shared internals, tests/ | NOT AUDITED | — | Full pass needed before shipping either app |

## Phase 0 fixes applied (2026-07-20)

1. ✅ **Receipt-cancel reversal fixed** — `lib/approvalEngine.ts` `receipt_cancel` approved branch previously only decremented `students.totalFeesPaid`, leaving `totalFeesDue`, `feeStatus`, and `studentFeeSummaries` stale. Now calls `recalculateStudentFeeSummary()` + `markSummaryDirty("receipt_cancel")`.
2. ✅ **Destructive routes tightened** — `erase-data`, `reset-app`, `restore-data` moved from `requireAdmin` (which included settings_manager) to `requireSuperAdmin`. `backup` (read-only export) left at `requireAdmin`; `bulk-delete` remains permission-gated (`students.delete`).
3. ✅ **Dead client-SDK financial libs neutralized** — `lib/paymentService.ts`, `lib/feeService.ts`, `lib/concessionService.ts` replaced with throwing deprecation stubs (verified zero importers). Physically delete when convenient.
4. ✅ **Unauthenticated cron endpoint fixed** — `PUT /api/cron/process-reminder-queue` (sends real WhatsApp/SMS) had no auth; now requires `x-cron-secret` == `CRON_SECRET` env or a signed-in admin. Set `CRON_SECRET` in env before wiring a scheduler.
5. ✅ **Auth sweep across 186 routes** — 177 use apiUtils helpers; verified the rest: `admin/salary` uses `requirePayrollAccess`, `biometric/*` uses `x-biometric-secret`, `create-teacher` & `admin/receipts/[receiptId]` re-export authed handlers, `login-id/check` / `academic-years/public` / `password-reset-requests` are public by design.

Note: student attendance module intentionally dropped from the plan per owner decision (Phase 4 removed).

Key open verification questions:
1. Is `recalculateStudentFeeSummary` called on concession create/update/delete?
2. Who writes `salary_advances` and does `/api/admin/salary` deduct them?
3. Does promotion carry forward pending fees?
4. Run `npm run typecheck:web` + `check:admin-api-auth` to confirm Phase 0 edits compile (shell unavailable during this session).
