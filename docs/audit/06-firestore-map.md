# 06 — Firestore Map

Built from a repo-wide grep of `collection("…")` across `apps/web` (full raw hit list captured during audit). Rules file: `firestore.rules` (root) — role-aware via custom claims.

## Core entities

| Collection | Written by | Read by | Notes |
|---|---|---|---|
| `users` | admin users/parents/teachers APIs, password-reset flow | apiUtils (role resolution), portal profile, login-id check | roles + parent accounts live here |
| `students` | students API (create uses `counters` for admission no.), promotions, class-sections merge, hostel allotments, transport assignments, concessions API, payments tx (balance fields), fee-reminder-action | everywhere (30+ readers) | ⚠ carries denormalized fee totals (`totalFeesDue`, `totalFeesPaid`, `feeStatus`) — single source of truth issue with `studentFeeSummaries` |
| `teachers` | teachers API, gps-settings, teacherAdmin lib | attendance, salary, reports, biometric, login-id | |
| `parent_student_links` | `lib/parentStudentLink.ts` | same | separate from `users`-based parent linking — check for duplication with `admin/parents/[parentId]/links` (which reads `students`) |
| `academic_years` | admin academic-years API | attendance/mark, payroll, receipts, finance dashboard, debit vouchers | activation flow exists (`[id]/activate`) |
| `branches` | branches API | `lib/branchContext.ts`, branch-accounts | |
| `settings` | class-sections API, misc | class config, receipts, portal receipt, dashboard rebuild | mixed-purpose settings bucket |
| `counters` | students API, finance invoices | same | admission/invoice numbering |

## Fees & finance

| Collection | Written by | Read by |
|---|---|---|
| `payments` | `POST /api/admin/payments` (tx), `/api/fees/confirm`, approvalEngine, ⚠ unused `lib/paymentService.ts` | 20+ finance/report/portal routes |
| `receipts` | payments tx, fees/confirm, receiptService | receipt pages/APIs |
| `receipt_counters` | `lib/receiptService.ts` (transactional per-year) | same |
| `payment_idempotency` | payments tx | payments tx |
| `payment_orders` | `/api/fees/order` | `/api/fees/confirm` |
| `studentFeeSummaries` | payments tx, feeRecalculation, sync-summaries, students API, class merge, bulk-delete | dashboard, dues, defaulters, receivables, reminders, reports (class-wise, student-wise) |
| `financeSummaries` | payments POST, fees/confirm, rebuild-dashboard-summary | dashboard-stats, admin dashboard page |
| `dashboardSummaries` | rebuild-dashboard-summary | admin dashboard page |
| `sync` / `system` | markSummaryDirty, sync APIs | dashboard, sync status |
| `fee_structures` | fee-structures API (⚠ also client `lib/feeService.ts`) | reminders route, fee pages |
| `concessions` | concessions API (+ client `lib/concessionService.ts` — duplicate) | dashboard-stats, fee pages |
| `feeAuditLogs` | payments, concessions (both API and client libs) | — ⚠ **written, never read** (no UI) |
| `incomes`, `expenses`, `purchases`, `vendors`, `bank_accounts`, `bank_transactions` | respective finance APIs | ledger, trial-balance, P&L, cash-book, daily, payables |
| `salary_reports` | `/api/admin/salary` | teacher salary, finance reports |
| `salary_advances` | `/api/admin/finance/advances` (writes to `teachers`? — route reads `teachers`; verify write target) | trial-balance, P&L, ledger, summary — ⚠ writer unclear, readers many: **verify** |
| `fee_dues`, `feeDueSummary` | quota guard lib | AI fee-message route |
| `invoices` — via `counters`; `deleted-bills` reads `audit_logs` | | |

## Attendance & HR

| Collection | Written by | Read by |
|---|---|---|
| `attendance` (STAFF only) | attendance/mark (GPS), admin/attendance, biometric/log, leaveReview | salary, reports/daily, teacher/me, staff/me, ai/context, dashboard rebuild |
| `attendance_logs` | attendance/mark, biometric | — audit trail |
| `attendance_edit_audit_logs` | admin attendance edits, leaveReview | — |
| `biometric_logs` | biometric ingest/log | `/admin/biometric` page (client read) |
| `student_attendance` | **NOBODY** | `/api/portal/attendance` | 🔴 **ORPHAN-READ: parent attendance page can never show data; no student attendance marking exists anywhere** |
| `leave_requests` | `/api/leave-requests` (teacher), admin leave API | salary, leaveReview |
| `holidays` | holidays APIs (declare/management) | salary, portal calendar, teacher/me, cron reminder queue |

## Academics

`exams`, `exam_marks` (exams APIs; portal reads), `homework`, `homework_submissions` (admin homework APIs; portal reads homework), timetable collection (timetable API), `promotions` (promotions history).

## Communication & misc

`notices`, `admin_notifications`, `notifications`, `password_reset_requests`, `password_reset_history`, `admin_audit_logs`, `audit_logs`, `backup_audit_logs`, `approval_requests`, `fee_reminders`, `fee_reminder_{settings,queue,logs}`, `downloads`, `messages` (via users/students), `transport_routes`, `vehicles`, `fuel_logs`, `daily_km_logs`, `maintenance_logs`, `insurance_records`, `library` (`books`, `library_issues`), `inventory_items`, `hostel_rooms`, AI: `aiSettings`, `aiLogs`, `aiCache`, `aiUsageDaily`, `aiUserUsageDaily`, `quotaSettings`, `roles` (sync-ai-permissions).

## Structural problems

1. 🔴 `student_attendance`: read-only orphan (see above).
2. 🟠 **Dual balance sources**: `students.totalFeesDue/Paid` AND `studentFeeSummaries.dueAmount/totalPaid` are both updated in the payment transaction — consistent there — but other writers (`recalculateStudentFeeSummary`, `sync-summaries`, class merge, client `lib/feeService.ts`) can update one without the other. Any drift shows different dues on different screens.
3. 🟠 `feeAuditLogs` and several `*_logs` collections are write-only (no reader UI) — fine as audit trails, but unverifiable by staff.
4. 🟠 Naming inconsistency: snake_case (`fee_structures`, `salary_reports`) vs camelCase (`studentFeeSummaries`, `feeAuditLogs`, `dashboardSummaries`); `notifications` vs `admin_notifications`.
5. 🟠 School/branch/year fields exist on payment docs from the API path, but legacy client-lib writes omit them → mixed-schema documents possible in `payments`.
6. 🟡 `parent_student_links` vs parent links via `users`/`students` — two linking mechanisms; confirm which is authoritative.
