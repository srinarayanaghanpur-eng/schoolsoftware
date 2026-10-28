# Fix Plan — NarayanaOS

Updated: 2026-10-28  
Branch: `hardening-batch`

This is the working plan before the next APK build. Do not start a new build until the P0 items are resolved and verified.

## Current State

Already changed in the working tree (not committed):

- Admission form fields are wired to the student record and DOCX.
- Student edit form preserves the full record instead of saving lean list-row data.
- Edit Student from the admission form deep-links to the class page and opens the modal.
- Transport route changes clear the old stop and transport fee; clearing transport persists.
- Previous-school and emergency-contact fields can be cleared.
- Admission preview/DOCX transport flag and printed-date parity fixed.
- Fee invariant helper (`lib/feeModel.ts`) and backup manifest helper added with regression tests.
- A1–A5 and P0 items 1–4 are implemented.
- Web/mobile typecheck, 88 unit tests, auth guard check, lint (warnings only), and `build:web` pass as of 2026-10-28.
- P0 item 5 (manual smoke test with real data) and a live restore drill are still pending.

Important: the finished APK predates these changes. The next build must happen after this plan is closed.

## Audit Addendum — Key Errors Found (2026-10-27)

Ranked by impact. These extend the P0/P1 lists below.

### A1. Parent can mark fees paid without paying (P0)

- `apps/web/app/portal/fees/page.tsx:57-64` and `apps/web/app/portal/page.tsx:98-105` create a payment order and immediately confirm it from the browser.
- `apps/web/app/api/fees/confirm/route.ts:14` explicitly has no gateway signature check; lines 26-27 allow parents, and lines 42/72 only check that the parent created the order.
- Result: any linked parent can mark their child's dues paid with a fake transaction id.

Fix: remove the parent self-confirm path. Manual payments must be confirmed by staff, or confirmation must require a server-verified gateway signature/webhook. Never let the payer confirm their own order.

### A2. Erase deletes data the backup never captured (P0)

- `apps/web/app/api/admin/backup/route.ts:5-19` exports only 13 collections (users, teachers, attendance, salary, settings, etc.).
- `apps/web/app/api/admin/erase-data/route.ts:67-72` deletes every collection except three audit logs.
- Students, payments, receipts, fee summaries, exams, transport, library and other modules are not in the backup but are erased.
- `backupChecksum` only checks that a backup audit doc exists, not that the backup contains the collections being erased.

Fix: back up every collection that erase can delete, store a manifest, and refuse erase unless the manifest covers all current collections. Add a restore drill test.

### A3. Portal and reports subtract payments twice (P0)

- `apps/web/app/api/portal/summary/route.ts:82` computes `due = totalFeesDue - totalFeesPaid`.
- `totalFeesDue` is already the remaining due in `lib/feeRecalculation.ts:58`, `api/fees/confirm/route.ts:162`, and `api/admin/payments/route.ts:294`.
- `lib/reportService.ts:47,100,265` does the same subtraction for outstanding/remaining amounts.

Result: partial payments show a lower due than reality; reports understate outstanding fees.

Fix: use one invariant. If `totalFeesDue` means remaining due, portal/report readers must use it directly. Add regression tests for partial payment.

### A4. Concession approval trusts the client and can double-apply (P0)

- `apps/web/app/api/admin/concessions/[id]/route.ts:57` takes `concessionAmount` and `userId` from the request body.
- Line 86 stamps `approvedBy` from the body; line 136 adds the body amount to `totalConcessionAmount`.
- There is no guard against approving an already-approved concession, so a repeated PATCH can add the amount again.

Fix: use the stored `concession.concessionAmount`, derive the actor from the verified token, require `status === "pending"`, and apply the student update transactionally/idempotently.

### A5. Portal private data is publicly cacheable (P0)

- `apps/web/app/api/portal/summary/route.ts:122`, `attendance/route.ts:66`, `homework/route.ts:51`, `notices/route.ts:72`, and `calendar/route.ts:61` set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`.
- These responses require auth and contain student-specific data (fees, attendance, notices, linked children). A shared CDN/proxy can serve one family's response to another.

Fix: use `private, no-store` for every authenticated portal response (the `jsonNoStore` helper already exists), or remove the cache headers.

### A6. Approval effects do nothing or leave stale class IDs (P1)

- `apps/web/lib/approvalEngine.ts:286-296` reads `payload.mobile/address/email`, but `apps/web/app/api/portal/profile/route.ts:76` stores `{ field, newValue }`. Approved parent profile changes are silently discarded.
- `apps/web/lib/approvalEngine.ts:257-262` updates promotion `class`/`section` but not `classId`/`sectionId`; class filters, fee summaries and portal views drift after promotion.

Fix: map `field/newValue` for profile updates; update `classId` and `sectionId` together with `class`/`section` on promotion. Add approval-effect tests.

### A7. Admission approval can be bypassed by the request body (P1)

- `apps/web/app/api/admin/students/route.ts:281` lets the request body override `requireApproval`.
- Line 349 then writes `admissionStatus: "approved"` without the approval workflow.
- Line 219 also trusts a body-supplied `schoolId` instead of deriving it from the token.

Fix: remove the client override; only the admissions setting may decide approval. Derive `schoolId` from the authenticated scope and validate it against the caller.

### A8. Finance collections are writable directly from clients (P1)

- `firestore.rules:310-327` allows accountant clients to create/update `payments`, `receipts`, `receipt_counters`, and `counters` directly.
- The app uses the Admin SDK for these writes, so these client write rules are unnecessary and bypass API validation, idempotency, receipts and audit logging.

Fix: make finance writes server-only (`allow write: if false`) and keep read rules for staff. Admin SDK bypasses rules, so no API change is needed.

### A9. Missing Firestore indexes break portal and promotion pages (P1)

- `firestore.indexes.json` has no indexes for:
  - `student_attendance` (`studentId` + `month` + `date`)
  - `homework` (`className` + `createdAt`/`dueDate`)
  - `promotions` (filters + `createdAt`)
  - `holidays` (`year` + `date`)
- These queries will fail with `FAILED_PRECONDITION` on a fresh project; some routes have no fallback.

Fix: add the composite indexes or remove the conflicting `orderBy`; verify with the emulator/index deploy before build.

### A10. Parent attendance has no data source (P1)

- `apps/web/app/api/portal/attendance/route.ts:35` reads `student_attendance`, but no code in the repo writes that collection.
- The parent attendance tab is therefore empty (or fails on the missing index above) even when teachers mark attendance.

Fix: add a student-attendance write path (teacher/class attendance) or hide the tab until the module exists.

## Implementation Status — 2026-10-28

| Item | Status | Notes |
| --- | --- | --- |
| A1 parent self-confirm | Done | `/api/fees/confirm` and `/api/fees/order` require `fees.create`; portal self-pay UI removed. Staff use `/admin/payments`. |
| A2 backup before erase | Done | Backup discovers every non-preserved collection and stores a manifest; erase validates collection coverage, document counts, and `usedForErase`. Unit restore drill passes. |
| A3 double subtraction | Done | Portal summary, reports, attendance-fee, and finance aggregation use payable/paid fee state once. |
| A4 concession approval | Done | Stored amount, verified actor, pending guard, transactional/idempotent student update; DELETE also uses the verified actor now. |
| A5 portal caching | Done | Authenticated portal responses use `private, no-store`; support-contact remains public. |
| P0 1 fee invariant | Done | `lib/feeModel.ts` is authoritative; student create/edit, concession, sync, payments, reminders, portal/report/admission readers updated. |
| P0 2 concession fallback | Done | Preview/DOCX use `resolveFeeState`; legacy annual-fee-only rows no longer look fully conceded. |
| P0 3 DOCX/preview parity | Done | Both use the shared fee state and formatting path. |
| P0 4 partial student update | Done | Server writes fee fields only when fee keys are present. Edit form now omits fee keys unless fee/transport fields were actually edited. |
| P0 5 manual smoke test | Pending | Must be run against real student data before APK/deploy sign-off. |

Open residual risks:

- Backup/erase validates document counts at erase time, but data can still change between the count check and deletion.
- Legacy students with inconsistent stored fee fields may still be read by untouched reminder/query paths until recalculated; no bulk backfill has been run.
- Concession approval audit/approval-record writes occur after the transaction, so a retry after a post-commit write failure returns `alreadyProcessed` without recreating them.
- `sync-summaries` repairs summaries but not student fee fields.

### Verification Commands

```powershell
npm run typecheck:web
npm --workspace @sri-narayana/mobile run typecheck
npm test
npm run test:hydration
npm run lint --workspace @sri-narayana/web
npm run check:admin-api-auth
npm run build:web
```

All commands pass. `npm test` reports 88 passing tests across 12 test files; `test:hydration` passes all 8 viewport/storage cases; `build:web` completes with existing warnings only.

## P0 — Must Fix Before Build

### 1. Make fee and concession totals consistent

Confirmed by code inspection. The code mixes two models:

- Student PATCH stores `totalFeeAmount` / `committedPayableFee` as the post-concession payable.
- `recalculateStudentFeeSummary()` and `sync-summaries` still subtract `totalConcessionAmount` again.
- Concession approval only adds to `totalConcessionAmount`; it does not reduce the committed fee.
- Editing a student recalculates the concession and can wipe an approved concession.
- Status-only updates (archive/restore) rewrite all fee fields.

Result: a concession can be counted twice, lost, or shown while not reducing dues.

Files:

- `apps/web/app/api/admin/students/[id]/route.ts`
- `apps/web/app/api/admin/students/route.ts`
- `apps/web/app/api/admin/concessions/[id]/route.ts`
- `apps/web/lib/feeRecalculation.ts`
- `apps/web/app/api/admin/finance/sync-summaries/route.ts`
- reminders, payments, and dashboard readers of fee summaries

Fix:

- Define one invariant. Recommended:
  - `originalFeeAmount` = pre-concession total
  - `committedPayableFee` / `totalFeeAmount` = final payable after concession
  - `totalConcessionAmount` = original minus committed (display/audit only)
  - `due = totalFeeAmount - totalFeesPaid`
- Update student create/edit, concession approval, fee recalculation, summary sync, and readers to follow the invariant.
- Recompute fee fields only when fee fields are sent; never on status-only or phone-only edits.
- Do not set `lastPaymentDate` to now during recalculation; use the actual latest payment date.
- Add regression tests for: no concession, approved concession, manual fee edit, archive/restore.

Acceptance:

- No concession: due equals committed fee minus paid.
- Approved concession: due equals post-concession payable minus paid, exactly once.
- Editing a phone/status leaves fee fields and concession unchanged.
- Admission preview and DOCX show the same total and concession.

### 2. Fix false full-fee concession fallback

File: `apps/web/app/admin/admission-form/[id]/useAdmissionData.ts` and `apps/web/lib/admissionDocx.ts`.

Problem: a legacy student with only an annual fee and no committed/payable amount gets `annual - 0`, so the whole fee appears as a concession.

Fix: only calculate the fallback difference when both an original amount and a payable amount exist. Prefer `totalConcessionAmount` when present.

Acceptance:

- Only annual fee: concession blank, not the full fee.
- Original and committed present: correct difference.
- Stored concession wins.

### 3. Make DOCX and preview match

Files: `apps/web/lib/admissionDocx.ts`, `apps/web/app/admin/admission-form/[id]/useAdmissionData.ts`.

Issues:

- DOCX money formatting only handles numbers; legacy numeric strings lose the `₹` and Indian grouping.
- DOCX does not use the screen's `Standard` fee-plan fallback.
- Created date formatting differs between screen and DOCX.

Fix: use one formatting rule for numeric strings and match the screen fallbacks.

Acceptance: the same student produces identical total fee, concession, fee plan, and created date in preview and DOCX.

### 4. Protect partial student updates

File: `apps/web/app/api/admin/students/[id]/route.ts`.

Problem: every PATCH rewrites fee-derived fields, even when only `status` or a phone changes.

Fix: build the fee update block only when `annualEnrollmentFee`, `commitmentFee`, `committedPayableFee`, `feeHeads`, or `transportFee` is present. Preserve stored values otherwise. Recalculate the summary only when relevant fields changed.

Acceptance: archive/restore, phone edits, and address edits do not touch fee fields; fee edits do.

### 5. Verify all current edit-flow fixes with real data

Manual smoke test:

- Open a student from the class list and from the admission form.
- Confirm photo, documents, all admission fields, previous school, emergency contact, and transport prefill correctly.
- Clear transport, save, reopen: route/stop/fee stay cleared.
- Clear previous school and emergency contact, save, reopen: stay cleared.
- Edit a student with a legacy string `previousSchool`.
- Confirm the admission form preview and DOCX match the saved record.

## P1 — Before or Immediately After Build

### 6. Guard the class-fee assignment script

File: `scripts/assign-class-fees.ts` (untracked).

Problem: `--apply` overwrites fee heads, committed fees, and concessions with generated class fees.

Fix: keep dry-run default; require an explicit force flag; skip students with custom fee heads or approved concessions unless forced; print before/after values; export a backup first. If this was a one-off migration, delete it instead.

### 7. Remove the stray root `app.json`

Untracked `app.json` contains only `{"expo": {}}` and is not the mobile app config. Confirm it is unused, then delete it.

### 8. Add tests for admission derivation

Add unit tests for:

- `formatMoney` (numeric string, number, blank, invalid).
- Transport-required labels (true, false, "No", route-only).
- Concession fallback and stored-concession precedence.
- Full detail fetch behavior if testable.

### 9. Document checklist categories

Current checklists infer document types from filenames, which is unreliable. Decide whether to:

- add explicit document-type metadata on upload (recommended), or
- keep the heuristic and accept that some boxes need manual checking.

This can ship after the P0 build if time is tight.

## Decisions Needed

1. Attendance bypass: `ATTENDANCE_BYPASS_GPS_AND_TIME = true` is marked as a temporary school request. Keep it for this build or restore GPS/time enforcement?
2. Concession model: confirm that an approved concession reduces the payable, and that `totalFeeAmount` means the final payable. This determines the P0 implementation.
3. Fee script: keep with safeguards, or delete as a one-off?
4. APK: build after P0 only, or include P1 items 6–7 too?
5. Commit: current work is uncommitted. Confirm whether to commit the verified set before the build.
6. Parent payment: disable parent self-confirm and require staff manual confirmation (fast, safe), or integrate a real gateway now (larger scope)?
7. Backup/erase: back up every collection before allowing erase (recommended), or disable erase until the backup/restore path is rebuilt?

## Verification Gate

Run from `E:\Notes\NarayanaOS`:

```powershell
npm run typecheck:web
npm run lint --workspace @sri-narayana/web
npm test
npm run check:admin-api-auth
npm run build:web
```

Then:

1. Manual admission/edit smoke test above.
2. Confirm no new lint warnings from changed files.
3. EAS preview build from a clean temporary copy (the real repo still uploads `.git` and hangs).
4. Download and test the APK.
5. Record the new build ID and APK URL.

## Out of Scope

- AI router work (cancelled).
- Broad cleanup of existing lint warnings unrelated to this change set.
- New admission features beyond the fixes above.
