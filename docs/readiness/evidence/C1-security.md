# Gate C1 — Security and data safety

- Commit: working tree (uncommitted)
- Date: 2026-10-31
- Operator: Engineering
- Environment: local (static review)
- Related gate owner: Security Lead
- Status: **In progress** — static checks pass, dynamic checks pending

## Static review results

| Check | Result | Evidence |
|---|---|---|
| Destructive routes use `requireSuperAdmin` | PASS | `api/admin/erase-data/route.ts:2,30`, `reset-app/route.ts:2,66`, `restore-data/route.ts:2,44` |
| Backup route guard | PASS (intentional) | `api/admin/backup/route.ts:3,12` uses `requireAdmin`; read-only export |
| Bulk delete guard | PASS | `api/admin/students/bulk-delete/route.ts:3,21` uses `requirePermission` |
| Cron routes authorized | PASS | All three cron routes call `isAuthorizedCronCall` (`create-reminder-queue`, `drive-backup`, `process-reminder-queue`) |
| Secret-bearing `settings` reads restricted | PASS with note | `firestore.rules:169-172` allows admin, settings_manager, principal, accountant — no longer every signed-in user |
| Reminder provider keys restricted | PASS with note | `firestore.rules:244` allows admin and accountant |
| Dead client financial writers have no importers | PASS | Grep for imports of `paymentService`, `feeService`, `concessionService` returns none |
| Raw `/api/admin` fetches attach auth | PASS | All 10 raw fetches attach `authorization: Bearer <token>` (AppShell, BackupErasePanel, BulkUploads, DeclareHolidayModal, lazyLoad) |
| Receipt-cancel reversal calls recalculation | PASS (static) | `lib/approvalEngine.ts:198-203` |

## Defects raised

| ID | Severity | Summary |
|---|---|---|
| C1-01 | P2 | Principal and accountant can read the `settings` doc that holds the biometric webhook secret |
| C1-02 | P2 | Accountant can read fee-reminder provider API keys in `fee_reminder_settings` |
| C1-03 | P3 | Dead client financial service stubs still exist (zero importers) |

No P0 or P1 issues found in the static review.

## Dynamic checks still required

These could not be run in this session (no Node commands) and keep the gate open:

- `npm run check:admin-api-auth`
- Deploy `firestore.indexes.json` and confirm no `FAILED_PRECONDITION` fallbacks
- Rules Playground verification for `settings` and `fee_reminder_settings`
- Receipt-cancel drill on a running environment
- Operator rotations: service-account key, web API key, admin passwords
- Set `CRON_SECRET`; add TTL on `rate_limits.expiresAt`

## Result

IN PROGRESS. Static review is clean; dynamic verification and operator
rotations are outstanding.

## Sign-off

- Name / role: pending Security Lead
- Date: —
