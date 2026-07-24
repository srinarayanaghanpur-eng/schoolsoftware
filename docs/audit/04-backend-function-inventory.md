# 04 — Backend Inventory

Backend = Next.js API routes (186 `route.ts` files under `apps/web/app/api`) + service libs in `apps/web/lib`. There are **no server actions** ("use server") and **no Cloud Functions** in the repo.

## Auth/permission helpers — `lib/apiUtils.ts` (used by API routes)
`resolveRole` (Firestore role overrides claim), `requireAdmin` (super_admin|admin|settings_manager), `requireSuperAdmin`, `requireTeacher`, `requireAuthenticated`, `requireRole`, `requirePermission`, `requireAllPermissions`, `requireAnyPermission`, `checkPermissionWithMessage`, `serializeDoc`, `json` (no-store). Backed by `lib/firebaseAdmin.ts` (`adminDb`, `verifyBearerToken`) and `lib/rbacAdmin.ts` (permission matrix, writes `audit_logs`). **Role checks happen server-side, not only in UI** — verified in `/api/admin/payments` (`requirePermission(request, "fees.view"/"fees.create")`). Root script `scripts/check-admin-api-auth.js` lint-checks that admin routes call these helpers.

## Server-side service libs (called from API routes — good pattern)

| File | Purpose | Reads | Writes |
|---|---|---|---|
| `lib/receiptService.ts` | Receipt numbering (transactional `receipt_counters` per academic year), receipt record build | `academic_years`, `receipts`, `payments`, `students` | `receipt_counters`, `receipts` |
| `lib/feeRecalculation.ts` | `validatePaymentAllowed`, `recalculateStudentFeeSummary` | `students`, `payments` | `students`, `studentFeeSummaries` |
| `lib/markSummaryDirty.ts` | Dashboard summary dirty flag | `sync` | `sync` |
| `lib/approvalEngine.ts` | Approval requests engine | `approval_requests`, `students`, `payments` | `approval_requests` |
| `lib/leaveReview.ts` | Leave approve/reject + attendance sync | `leave_requests` | `attendance`, `attendance_edit_audit_logs`, `admin_audit_logs` |
| `lib/auditLog.ts` | Audit writer | — | `audit_logs` |
| `lib/branchContext.ts`, `lib/schoolScope.ts` | Branch/school scoping | `branches` | — |
| `lib/debitVoucherService.ts`, `lib/busFinanceService.ts`, `lib/reportService.ts`, `lib/financeAggregation.ts` | Finance/reporting | payments/incomes/expenses etc. | vouchers/reports |
| `lib/reminder/*`, `lib/feeReminderHelpers.ts` | WhatsApp/SMS reminder providers + message builder | reminder collections | reminder collections |
| `lib/ai/*`, `lib/quota/*` | Gemini client, logging, quota guards | `aiSettings`, `aiLogs`, `aiCache`, `aiUsageDaily`, `aiUserUsageDaily`, `quotaSettings`, `fee_dues`, `feeDueSummary` | same |
| `lib/parentStudentLink.ts` | Parent↔student links | `parent_student_links` | `parent_student_links` |
| `lib/teacherAdmin.ts`, `lib/authClaims.ts` | Teacher account + custom claims sync | `teachers` | `teachers`, Auth claims |

## Client-side Firestore services — ⚠ legacy/duplicate layer

| File | Status | Evidence |
|---|---|---|
| `lib/paymentService.ts` | **UNUSED + DUPLICATE** of `POST /api/admin/payments`. Client-SDK batch write, receipt number NOT transactional, no schoolId/academicYearId on payment docs, no idempotency. | grep: imported by zero files |
| `lib/feeService.ts` | Direct client CRUD on `fee_structures`, `students`, `concessions`, `payments`. Not imported by any page (grep for `@/lib/feeService` = 0). Likely dead. | grep |
| `lib/concessionService.ts` | Client CRUD on `concessions` + `feeAuditLogs`; duplicates `/api/admin/concessions`. Import status: verify. | partially verified |
| `lib/firebaseQueryOptimization.ts`, `lib/lazyLoad.ts` | Client reads of `students`, `teachers`, `payments`, `attendance` for perf tooling | in use by dashboard-type pages |

**Risk**: any client-SDK write path bypasses API validation and depends entirely on `firestore.rules`. Rules exist and are role-aware, but the duplicate write logic can produce documents missing `schoolId`/`academicYearId` (verified missing in `lib/paymentService.ts` payload vs present in the API payload).

## API route families (186 routes)

- **Admin CRUD**: students (+[id], bulk-delete), teachers (+[teacherId], reset-password), parents (+links, reset-password), users (+role, students), class-sections (+merge), academic-years (+activate), branches, holidays (+declare, management), timetable, exams (+marks, publish, report-card, hall-ticket), homework (+submissions grading), concessions, fee-structures, promotions (+history), approvals, leave-requests, gps-settings, backup/erase-data/restore-data/reset-app, sync (status/force/rebuild-dashboard-summary), messages, notices, notifications, communication requests.
- **Finance**: payments, receipt (+cancel, print), invoices, expenses, incomes, purchases (+pay), vendors, payables, receivables, dues, defaulters, installments, cash-book, ledger, trial-balance, profit-loss, summary, daily (+closing), bank-accounts (+transactions), branch-accounts, debit-vouchers (+print), deleted-bills, sync-summaries, advances, reminders; salary; bus-finance (+emi-schedule, reports, emi-payments).
- **Fee reminders**: fee-reminders (+[id]), fee-reminder-{settings,queue,logs,history,dashboard,action}; `cron/create-reminder-queue`, `cron/process-reminder-queue`.
- **Teacher/staff**: `teacher/me`, `teacher/salary`, `staff/me`, `attendance/mark`, `leave-requests`, `biometric/{ingest,log}`.
- **Portal (parent)**: children, summary, profile, payments (+receipt), fees(via summary), attendance, exams, homework, notices, calendar, transport, downloads, messages.
- **Misc**: `login-id/check`, `password-reset-requests` (+admin approve flow), `academic-years/public`, `reports/daily`, `fees/order` + `fees/confirm` (online payment orders → `payment_orders`), `ai/*`, `quota/*`.

## Findings

1. `BACKEND EXISTS — FRONTEND NOT CONNECTED`: none found so far among API routes (each family has a page); the *unused* backends are the client-side service libs above.
2. `UI ONLY — BACKEND NOT CONNECTED`: none among sampled admin pages; the broken case is portal attendance (backend reads a never-written collection).
3. Duplication: payment write logic exists 3× (`/api/admin/payments` transaction, `lib/paymentService.ts`, `/api/fees/confirm` online-payment confirm which re-implements payment+receipt+summary writes). The `fees/confirm` path also writes `financeSummaries` — keep these two in sync or unify.
4. Per-route input validation is inconsistent: `/api/admin/payments` validates manually (no zod), zod is a dependency; a systematic zod audit per route is pending.
