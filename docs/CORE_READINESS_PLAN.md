# Core Readiness Plan

Status: Active
Owner: Engineering
Last updated: 2026-10-31
Related: `docs/audit/15-production-readiness-plan.md`, `docs/DESKTOP_PLAN.md`

## 1. Purpose

NarayanaOS is **Partially Functional**, not production-ready
(`docs/audit/ERP-AUDIT-SUMMARY.md`). This plan defines the work required to move
the core product through a real readiness gate. The Electron desktop plan is
blocked behind this gate and must not start until C7 is signed off.

The rule for every item: **verify in code and in a running environment before
claiming it done.** An audit note is not evidence; a passing command, a CI run,
or a recorded UAT session is.

## 2. How this plan is controlled

### 2.1 Dependency graph

```
C0 baseline
  -> C1 security
  -> C2 auth/year scoping
  -> C3 student master + import
  -> C4 fee integrity
  -> C5 attendance scope decision
  -> C6 payroll/exams/reminders/notifications
  -> C7 UAT + sign-off
```

Hard dependencies:

| Dependency | Why |
|---|---|
| C2 before C3 and C4 | Imports and fee writes must carry a valid `academicYearId` |
| C3 before C4 | Fee invariants need real imported students to test against |
| C5 before C6 | Absence notifications and the C7 test plan both depend on the attendance decision |
| C4 before C7 | The UAT fee cycle is meaningless without trustworthy balances |
| C1 can overlap C2 | Security fixes are independent of year-scoping work |

C5 is a **decision gate**, not a build gate. It must be closed in writing before
C6 starts. Building attendance, if chosen, is a separate scope addition that
moves C7.

### 2.2 Gate ownership

Roles, not names. Names are filled in the evidence file when a gate opens.

| Gate | Accountable | Responsible | Consulted | Informed |
|---|---|---|---|---|
| C0 Baseline | Engineering Lead | DevOps/Operator | QA Lead | Product Owner |
| C1 Security | Security Lead | Backend Lead | DevOps | Product Owner |
| C2 Auth/year | Backend Lead | Backend Engineer | Frontend Lead | QA Lead |
| C3 Student master | Backend Lead | Backend + Frontend | Product Owner | QA Lead |
| C4 Fee integrity | Finance/Backend Lead | Backend Engineer | Accountant | Product Owner |
| C5 Scope decision | Product Owner | Engineering Lead | Principal/Teachers | QA Lead |
| C6 Modules | Engineering Lead | Module owners | Finance/Accountant | Product Owner |
| C7 UAT | QA Lead | QA + Engineering | Product Owner | All stakeholders |

A gate does not close until the accountable role signs its evidence file.

### 2.3 Evidence and sign-off

All readiness artifacts live under `docs/readiness/`:

```
docs/readiness/
  README.md              gate dashboard: gate, status, owner, date, commit
  evidence/
    C0-baseline.md
    C1-security.md
    C2-auth-year.md
    C3-student-master.md
    C4-fee-integrity.md
    C5-scope-decision.md
    C6-modules.md
    C7-uat.md
  DEFECTS.md             triaged defect register with severity
  DEFERRED.md            formally deferred items with owner sign-off
  UAT.md                 UAT checklist and results
  SIGNOFF.md             final release sign-off
```

Every evidence file uses this template:

```markdown
# Gate Cx — <name>
- Commit: <sha>
- Date: <ISO date>
- Operator: <name / role>
- Environment: <local | staging | CI>
- Commands run: <exact commands>
- Output: <CI run URL or pasted summary>
- Manual checks: <checklist with pass/fail>
- Result: PASS | FAIL
- Signed off by: <name / role> on <date>
```

Command output must be linked to a CI run or pasted verbatim. Screenshots alone
are not evidence for a PASS on a build or test gate.

### 2.4 Defect severity

Severity is assigned at triage by the gate accountable role. "Open" means not
verified fixed on the release commit.

| Severity | Definition | Examples | Release rule |
|---|---|---|---|
| P0 Blocker | Money wrong, data loss/corruption, security breach, or a core workflow impossible | Receipt changes a balance incorrectly; unauthenticated destructive route; app cannot build | Zero open. No release, no exceptions |
| P1 Critical | Core workflow broken but a workaround exists; reports materially wrong; limited authz gap; performance makes a daily task unusable | Parent portal attendance empty; payroll omits advances; import corrupts one column | Zero open. Fix or formally defer with Product Owner sign-off |
| P2 Major | Non-core feature broken, or a core workflow degraded with a workaround | Duplicate academic-years page; reminder UI duplicated; slow report | Not blocking. Tracked with target milestone |
| P3 Minor | Cosmetic or copy issue with no functional impact | Misaligned table; inconsistent label | Backlog |
| P4 Trivial | Nit | Spelling, spacing | Backlog |

C7 requires **zero open P0 and zero open P1**. Any P1 deferral must be recorded
in `DEFERRED.md` with the Product Owner's name and rationale.

## 3. Verified current state

Checked against the working tree on 2026-10-31.

| Area | Status | Evidence |
|---|---|---|
| Build and typecheck | Unverified this session | Re-run in C0 on a normal machine |
| Test coverage | Thin | `tests/e2e/smoke.spec.ts` and `app/api/attendance/mark/capturedAt.test.ts` only |
| Working tree | Dirty | Uncommitted student-profile and certificate changes |
| Security Phase 0 | Mostly done | `docs/audit/AUDIT-PROGRESS.md` Phase 0 items 1-5 |
| Receipt-cancel reversal | Fixed, needs re-verification | `lib/approvalEngine.ts:144-209` |
| Concession recalc | Partial | `api/admin/concessions/[id]/route.ts:220`; create/delete unverified |
| Fee model | Dual-write, single recompute function | `lib/feeRecalculation.ts` writes both `students` and `studentFeeSummaries` |
| Payment lifecycle | completed / cancellation_requested / cancelled | `api/admin/payments/route.ts:262`, `lib/approvalEngine.ts:154,207` |
| Refunds | No first-class path | Only cancellation reverses a payment |
| Bulk import | Partial | `api/admin/settings/bulk-upload/route.ts`: fee-structures, transport-routes, book-prices, students; parents and fee assignment unconfirmed |
| Student attendance | Missing | Read by `api/portal/attendance/route.ts`; no writer exists |
| Student attendance scope | Dropped by owner | `docs/audit/AUDIT-PROGRESS.md:30`; must be formally recorded |
| Parent linking | Resolved in code | `parent_student_links` + `lib/parentStudentLink.ts`; legacy field cleanup still needed |
| Salary advances | Not deducted | No `advance` reference in `api/admin/salary/route.ts` |
| Fee reminders | Unwired | Cron routes exist; no scheduler or credentials |
| Audit-log viewer | Missing | Five log collections, no UI |
| Secrets | Rotation pending | `NarayanaOS-Production-Readiness-Report.md` section 9 |

## 4. Fee data design

C4 is the highest-risk gate. This section defines the model before any code
changes, so "single source of truth" has a precise meaning.

### 4.1 Authoritative inputs

These fields describe what the student was *assigned*. They are inputs, not
computed values, and are written only by admission, fee-structure assignment,
and approved concessions.

| Input | Canonical field | Legacy aliases |
|---|---|---|
| Original annual fee | `originalFeeAmount` | `annualEnrollmentFee` |
| Payable fee after concession | `committedPayableFee` | `commitmentFee` |
| Concession amount | `totalConcessionAmount` | `concession` |
| Per-head breakdown | `feeHeads[]` | — |
| Academic year | `academicYearId` | — |
| School / branch | `schoolId`, `branchId` | — |

Money events are authoritative in the `payments` collection. Only documents with
`status === "completed"` count toward money received. `cancellation_requested`,
`cancelled`, `failed`, `refunded`, `deleted`, and `pending` count as zero.

Concessions are authoritative only when `status === "approved"`.

### 4.2 Derived fields

These are computed and must never be hand-edited or written by a route directly:

| Location | Derived fields |
|---|---|
| `students` | `totalFeesPaid`, `totalFeesDue`, `feeStatus`, `lastPaymentDate`, `feeLastUpdated` |
| `studentFeeSummaries` | `totalFee`, `totalPaid`, `totalConcession`, `dueAmount`, `feeStatus`, `lastPaymentDate` |

Rule: the only writer of these fields is `recalculateStudentFeeSummary()` in
`lib/feeRecalculation.ts`. `api/admin/finance/sync-summaries` is a repair tool,
not a normal write path.

### 4.3 Consistency mechanism

1. Every fee mutation calls `recalculateStudentFeeSummary(studentId,
   academicYearId)` after its write, then `markSummaryDirty()`.
2. Recalculation is idempotent: it recomputes from inputs and completed payments,
   never increments stored values.
3. A reconciliation report compares `students` derived fields against
   `studentFeeSummaries` and against a fresh recomputation. Drift is a defect,
   not a warning.
4. A one-time backfill normalizes legacy aliases into canonical fields and
   computes fee inputs for documents that only have derived values.
5. After backfill, `resolveFeeState` must stop using `totalFeesPaid +
   totalFeesDue` as a fee-input fallback. That fallback makes derived fields
   inputs and creates a circular dependency.

### 4.4 Financial invariants

For a student `s` in academic year `y`, define:

- `P(s,y)` = payments where `studentId = s`, `academicYearId = y`,
  `status = completed`
- `paid(s,y)` = sum of `amountPaid` over `P(s,y)`
- `payable(s)` = `committedPayableFee` (resolved per `lib/feeModel.ts`)
- `concession(s)` = clamp(`originalFeeAmount - payable(s)`, 0, `originalFeeAmount`)
- `due(s,y)` = max(0, `payable(s) - paid(s,y)`)

Invariants:

| ID | Invariant |
|---|---|
| I1 | `students.totalFeesPaid == paid(s,y)` and `summaries.totalPaid == paid(s,y)` |
| I2 | `students.totalFeesDue == due(s,y)` and `summaries.dueAmount == due(s,y)` |
| I3 | `feeStatus == paid` when `due == 0`; `partial` when `due > 0 && paid > 0`; `pending` otherwise |
| I4 | `totalConcessionAmount == concession(s)` |
| I5 | `payable(s) + concession(s) == originalFeeAmount` when the original fee is known |
| I6 | Every completed payment satisfies `0 < amountPaid <= due` at write time; lifetime payments never exceed `payable` |
| I7 | Cancelling a payment moves it to `cancelled`, marks its receipts `cancelled`, decrements the matching `financeSummaries` month rollup exactly once, and reduces `paid` by `amountPaid` |
| I8 | Replaying the same idempotency key returns the original `paymentId`/`receiptId` and changes no balance |
| I9 | Pending or failed payment orders contribute zero to `paid` and `due` |
| I10 | A cancelled payment contributes zero; a rejected cancellation restores `completed` and restores its amount exactly once |
| I11 | Applying the same approval decision twice leaves all derived values unchanged |
| I12 | Payments from another academic year never affect `due(s,y)` or `summaries(y)` |

Refunds: there is no first-class refund path in code today. v1 policy is
**cancellation only, no partial refunds**. If the owner needs partial refunds,
that is a new scope item with its own invariant (negative adjustment or a
`refunded` payment with its own audit trail) and must be decided before C4
closes.

### 4.5 Known year-isolation risk

`recalculateStudentFeeSummary` currently sums every `completed` payment for a
student without filtering by `academicYearId` (`lib/feeRecalculation.ts:43-47`).
If a student document survives across years (promotion reuses the same doc),
last year's payments leak into this year's balance. C4 must either:

- filter payments by `academicYearId` and `schoolId`, or
- confirm student documents are year-scoped and document that assumption.

This is an I12 violation until resolved.

## 5. C5 scope dependency

The attendance decision changes other gates. It must be closed before C6 starts
and before the C7 test plan is frozen.

**Decision (2026-10-31): DEFER.** The owner confirmed student attendance is not
needed for this release. Evidence:
`docs/readiness/evidence/C5-scope-decision.md`. The parent portal page is hidden
and replaced with a not-available notice; the API route is dormant. C6 absence
notifications are out of scope and C7 tests staff attendance only.

| C5 choice | Effect on C6 | Effect on C7 |
|---|---|---|
| **Defer** | Absence notifications are out of scope; remove the dependency from C6.4 | C7 skips the student attendance cycle; `/portal/attendance` must be hidden or relabeled, with the orphan read removed |
| **Build** | C6.4 must include absence events; estimate grows | C7 adds a full student attendance cycle; timeline grows 2-4 weeks |

Leaving C5 open is not an option: it would make C6 scope undefined and C7
untestable.

## 6. Gates

### C0 — Baseline and freeze (1-2 days)

Depends on: nothing.
Must-have: everything in this gate.

Tasks:

1. Commit or deliberately stash the uncommitted student-profile/certificate work.
   Do not mix it with readiness fixes.
2. On a machine with a normal network (repo outside OneDrive), run the full
   verification suite and archive the output.
3. Tag the baseline commit.
4. Freeze `main` to readiness fixes until C7.

Verification commands (operator-run):

```
npm ci --legacy-peer-deps
npm run typecheck:web
npm run typecheck --workspace @sri-narayana/mobile
npm run lint --workspace @sri-narayana/web
npm test
npm run build:web
npm run check:admin-api-auth
```

E2E requires the emulator in a second shell:

```
npm run test:emulator:start
npm run test:e2e
```

Exit criteria:

- All commands pass; output recorded in `docs/readiness/evidence/C0-baseline.md`.
- `main` is clean and tagged.
- Accepted warnings are listed explicitly.

### C1 — Security and data safety (3-5 days)

Depends on: C0.
Must-have: all tasks.

Tasks:

1. Run `check:admin-api-auth`; fix every route that bypasses a guard.
2. Re-verify `requireSuperAdmin` on `erase-data`, `reset-app`, `restore-data`;
   confirm `backup` and `bulk-delete` guards are intentional.
3. Confirm no client-SDK financial writes remain; delete the deprecation stubs in
   `lib/paymentService.ts`, `lib/feeService.ts`, `lib/concessionService.ts` once
   they have zero importers.
4. Deploy `firestore.indexes.json`; verify no `FAILED_PRECONDITION` fallbacks.
5. Review `firestore.rules` against actual client reads; confirm secret-bearing
   `settings` fields are not readable by every signed-in user.
6. Re-run the receipt-cancel drill: collect, cancel, confirm `students` and
   `studentFeeSummaries` agree.
7. Operator: rotate service-account key, web API key, and admin passwords; set
   `CRON_SECRET`; add TTL on `rate_limits.expiresAt`.

Exit criteria:

- Auth checker passes.
- Rules and indexes deployed and verified.
- Secrets rotated and recorded.
- Receipt-cancel drill recorded.

### C2 — Auth, roles, academic year (1 week)

Depends on: C0. May overlap C1.
Must-have: all tasks.

Tasks:

1. Decide and document role-change propagation: force token refresh, or accept a
   bounded lag.
2. Remove the duplicate academic-years page; keep one.
3. Make `academicYearId` required on all scoped writes and default-enforced on
   list APIs.
4. Confirm `settings_manager` scope (restricted in `458b8c7`) and record it.
5. Add unit tests for role resolution and year scoping.

Exit criteria:

- No scoped write can omit `academicYearId`.
- One academic-years surface.
- RBAC and year-default tests pass.

### C3 — Student master data and onboarding (1-2 weeks)

Depends on: C2.
Must-have: all tasks.

Tasks:

1. Verify admission through fee-structure assignment end to end.
2. Parent model is decided: student contact fields are authoritative for
   documents; `parent_student_links` is the only account linkage. No `parentId`
   on students. Remaining work is bulk-import parent columns and a one-way
   backfill of missing student contact fields. See
   `docs/readiness/evidence/C3-parent-model-decision.md`.
3. Extend `api/admin/settings/bulk-upload/route.ts` so the student import
   includes parents and fee assignment, with a template, dry-run mode, and a
   row-level error report.
4. Add idempotency and duplicate detection on student/parent import.
5. Audit student master reads for year and school scoping.

Exit criteria:

- A 50-student sample imports cleanly into staging.
- Imported students have correct fee summaries and linked parents.
- Re-running the same file creates no duplicates.

### C4 — Fees and finance integrity (2-3 weeks)

Depends on: C3.
Must-have: all tasks, including the refund policy decision.

Tasks:

1. Implement the model in section 4: canonical inputs, derived-only fields,
   single recompute writer, and backfill.
2. Fix the year-isolation defect in section 4.5.
3. Route every fee mutation through `recalculateStudentFeeSummary` plus
   `markSummaryDirty`: payments, concessions create/update/delete, installments,
   receipt cancel, promotions carry-forward.
4. Verify year-end carry-forward of pending fees.
5. Verify online payment signature handling in `api/fees/confirm/route.ts`.
6. Add invariant tests for I1-I12 on fixtures, including cancellation, rejection,
   replay, pending orders, and cross-year payments.
7. Add a reconciliation report/script and run it against staging data.
8. Reconcile finance reports to read from `studentFeeSummaries`.

Files in scope: `lib/feeModel.ts`, `lib/feeRecalculation.ts`,
`lib/approvalEngine.ts`, `lib/changeApprovals.ts`, `lib/financeAggregation.ts`,
`api/admin/payments/route.ts`, `api/admin/concessions/**`,
`api/fees/confirm/route.ts`, `api/admin/students/[id]/route.ts`,
`api/admin/finance/sync-summaries/route.ts`.

Exit criteria:

- Invariant tests pass on fixtures and staging data.
- Concession create, update, and delete recalculate correctly.
- Carry-forward is demonstrated across a simulated year rollover.
- Reconciliation reports zero drift.

### C5 — Attendance scope decision (1 day)

Depends on: C2 (for year scoping of any future attendance writes).
Must-have: a written decision.

Decision: **DEFER** (2026-10-31), recorded in
`docs/readiness/evidence/C5-scope-decision.md`. The deferral actions below are
implemented.

Option A — Defer:

- Record the decision in `docs/readiness/evidence/C5-scope-decision.md`.
- Hide or relabel `/portal/attendance`; remove or gate the orphan read in
  `api/portal/attendance/route.ts`.
- Confirm the parent portal has no other dependency on student attendance.

Option B — Build:

- `POST /api/teacher/student-attendance` writing `student_attendance` with docId
  `{classId}_{sectionId}_{date}` for duplicate prevention.
- Teacher roster UI, admin oversight page, parent portal read.
- Absence notification hook (feeds C6.4).
- Re-baseline C6 and C7.

Exit criteria:

- Signed decision recorded.
- If deferred: no broken or misleading page remains.
- If built: teacher can mark a class, parent can see it, duplicate submits are
  rejected.

### C6 — Payroll, exams, reminders, notifications (2-3 weeks)

Depends on: C5 (decision only).
Must-have and deferrable items are split in section 7.

Tasks:

1. Payroll: deduct `salary_advances` in `api/admin/salary/route.ts`, add approval
   and month lock.
2. Exams: server-side max-marks validation, hall-ticket QA.
3. Fee reminders: wire an external scheduler to `/api/cron/*` with `CRON_SECRET`
   and provider credentials; collapse the duplicate reminder UIs.
4. Notifications: FCM registration plus payment and notice events; absence
   events only if C5 chose to build. Unify `notifications` and
   `admin_notifications`.
5. Audit-log viewer over `audit_logs`, `feeAuditLogs`, `admin_audit_logs`.

Exit criteria:

- Every must-have item passes.
- Every deferrable item is either done or recorded in `DEFERRED.md` with owner
  sign-off.
- No visible broken page remains.

### C7 — UAT and staging sign-off (1-2 weeks)

Depends on: C4, C5, C6.
Must-have: all tasks.

Tasks:

1. Deploy staging with production-like configuration and anonymized data.
2. Run the full fee cycle: admit, assign fees, collect cash/online/UPI, print
   receipt, cancel, re-collect, verify balances.
3. Run the staff attendance cycle; run student attendance only if C5 built it.
4. Exercise every role: `super_admin`, `admin`, `principal`, `accountant`,
   `teacher`, `parent`, `settings_manager`.
5. Backup, erase, and restore drill with a manifest check.
6. Mobile smoke and desktop wrapper smoke.
7. Performance pass: Lighthouse, Firestore read budget, no blank-screen states
   under quota errors.
8. Triage every defect in `DEFECTS.md`; confirm zero open P0/P1.

Exit criteria:

- Signed UAT checklist in `docs/readiness/UAT.md`.
- Zero open P0 and P1 defects.
- Staging matches the release commit.
- `docs/readiness/SIGNOFF.md` signed by QA Lead and Product Owner.
- Desktop plan is unblocked.

## 7. C6 must-have vs deferrable

C6 is intentionally split so the gate cannot become open-ended.

| Item | Class | Rationale |
|---|---|---|
| Payroll `salary_advances` deduction | Must-have | Money correctness |
| Payroll month approval + lock | Must-have | Prevents retroactive payroll edits |
| Exam server-side max-marks validation | Must-have | Data integrity |
| Hall-ticket QA | Must-have | Existing visible feature correctness |
| Payslip PDF | Deferrable | Convenience; payroll totals already correct |
| Grade bands | Deferrable if report cards remain correct | Configuration polish |
| Report-card PDF | Deferrable if an existing print path works | Convenience |
| Fee reminder scheduler + credentials | Deferrable with owner sign-off | Operational; no data risk |
| Collapse duplicate reminder UIs | Deferrable | P2 UX issue |
| FCM push notifications | Deferrable with owner sign-off | Portal still shows data without push |
| Unify notification collections | Deferrable | Technical debt |
| Audit-log viewer | Deferrable unless compliance requires it | Logs are written; only viewing is missing |
| Absence notifications | Depends on C5 | Out of scope if attendance is deferred |

A deferral is valid only if it is listed in `DEFERRED.md` with: item, reason,
risk accepted, Product Owner name, and target milestone.

## 8. Deferred register

`docs/readiness/DEFERRED.md` is the only place a deferred item may live. Items
not listed there are assumed in scope. C7 cannot close while a deferrable item
is missing from that file.

## 9. Test strategy

| Layer | Scope | Where |
|---|---|---|
| Unit | Fee invariants I1-I12, idempotency, year scoping, RBAC, import parsing | `*.test.ts` via `scripts/run-tests.mjs` |
| API integration | Route guards, validation, transactional reversals | Emulator-backed tests |
| E2E | Fee cycle, attendance, role routing, parent portal | `tests/e2e` with Playwright |
| Manual UAT | Real workflows with anonymized data | Staging, recorded in `UAT.md` |

Every gate adds tests; a gate is not closed on manual checks alone.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Audit documents are stale in places | Wasted work or false confidence | Re-verify each item in code before starting it |
| Uncommitted working-tree changes | Baseline unknown | C0 commits or stashes them first |
| Dual fee stores resist unification | Financial drift | Section 4 is a blocking design task, not cleanup |
| Year-isolation defect | Wrong balances after promotion | Fix in C4 with cross-year invariant test |
| No external scheduler | Reminders stay unwired | Decide hosting early or defer formally |
| Firestore free-plan quotas | Rate limiting and reporting degrade | Monitor; size read budgets in C7 |
| C5 left open | C6 scope undefined, C7 untestable | Decision gate closes before C6 |
| C6 scope creep | Release gate never closes | Must-have/deferrable split in section 7 |

## 11. Open questions

1. Is student attendance permanently dropped, or deferred to a later phase?
2. Are student documents year-scoped, or reused across years by promotion?
3. Do partial refunds exist as a business requirement, or is cancellation enough?
4. Where will the cron scheduler run if Vercel scheduling is insufficient?
5. Who owns UAT, and can anonymized school data be used on staging?
6. Is the audit-log viewer a compliance requirement or a convenience?

## 12. Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-31 | Desktop work is blocked until C7 | Desktop wraps the web app and inherits its defects |
| 2026-10-31 | Readiness is evidence-based, not audit-note-based | Prior reports conflict; only executed verification counts |
| 2026-10-31 | `studentFeeSummaries` is the derived read-model; `students` fee inputs are authoritative | Removes ambiguity between the two stores |
| 2026-10-31 | Only `recalculateStudentFeeSummary` may write derived fee fields | Single writer prevents drift |
| 2026-10-31 | v1 refunds are cancellation-only unless the owner says otherwise | No refund path exists today; partial refunds need new invariants |
| 2026-10-31 | C5 is a decision gate that blocks C6 and C7 | Attendance scope changes notifications and UAT |
| 2026-10-31 | C6 splits must-have from deferrable | Prevents an open-ended release gate |
| 2026-10-31 | Student attendance is deferred; portal page hidden and API left dormant | Owner confirmed it is not needed; avoids a 2-4 week scope addition |
| 2026-10-31 | Student contact fields are authoritative for documents; `parent_student_links` is the only account linkage | The two layers serve different purposes; no dual-write of identity |
