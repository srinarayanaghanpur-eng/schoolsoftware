# 05 — API Map (key endpoints, verified)

No server actions exist; all backend is REST routes. Bearer-token auth via `Authorization` header from `lib/adminApiClient.ts`. Statuses: ✅ verified in code, ◐ structure verified / details pending.

| Method | Endpoint | Caller (page) | AuthZ | Firestore ops | Status |
|---|---|---|---|---|---|
| GET | `/api/admin/payments` | `/admin/payments` | `requirePermission("fees.view")` | reads `payments` w/ school/branch/year/class filters, cursor pagination, missing-index degraded fallback | ✅ |
| POST | `/api/admin/payments` | `/admin/payments` | `requirePermission("fees.create")` | `runTransaction`: idempotency (`payment_idempotency`), `payments`, `receipts` (tx receipt counter), `students` balance, `studentFeeSummaries`; then `feeAuditLogs`, `financeSummaries`, `markSummaryDirty` | ✅ |
| POST | `/api/admin/finance/receipt/[paymentId]/cancel` | payments/receipt pages | finance perms | updates `payments` (cancel); balance-reversal depth pending | ◐ |
| POST | `/api/attendance/mark` | `TeacherAttendancePanel` (teacher dashboard) | teacher token | validates `academic_years` active, `teachers` GPS config; writes `attendance`, `attendance_logs` | ✅ |
| GET/POST | `/api/admin/attendance` | `/admin/attendance` | admin perms | `attendance` + `attendance_edit_audit_logs` + `admin_audit_logs` | ✅ |
| POST | `/api/biometric/ingest`, `/api/biometric/log` | external device / `/admin/biometric` | device key (verify) | `biometric_logs` → `attendance`, `attendance_logs` | ◐ |
| GET/POST | `/api/admin/salary` | `/admin/salary` | payroll perms (`lib/payrollAccess.ts`) | reads `teachers`, `attendance`, `holidays`, `leave_requests`; writes `salary_reports` | ◐ |
| GET | `/api/teacher/salary` | `/teacher/salary` | `requireTeacher` | reads `salary_reports` | ✅ |
| GET | `/api/teacher/me` | `/teacher/dashboard` | `requireTeacher` | `users`, `teachers`, `attendance`, `holidays` | ✅ |
| CRUD | `/api/admin/students`, `[id]`, `bulk-delete` | `/admin/students` | admin perms | `students`, `counters` (admission no.), `settings` (class config), `studentFeeSummaries` | ◐ |
| CRUD | `/api/admin/teachers`, `[teacherId]`, `reset-password` | `/admin/teachers` | admin | `teachers`, `users`, `password_reset_*`, `admin_audit_logs` | ◐ |
| CRUD | `/api/admin/parents*` | `/admin/parents` | admin | `users` (role=parent), `students` links, `password_reset_history` | ◐ |
| POST | `/api/admin/users/[uid]/role` | `/admin/users` | admin/super | `users` (+ claims sync expected via `lib/authClaims.ts`) | ◐ |
| CRUD | `/api/admin/exams*` (marks, publish, report-card, hall-ticket) | `/admin/exams`, `[id]` | admin | `exams`, `exam_marks`, `students` | ◐ |
| GET | `/api/portal/*` (summary, payments, attendance, exams, notices, homework, calendar, transport, profile, children, downloads, messages) | `/portal/*` | parent token + `lib/portalHelpers.ts` child resolution | reads `students`, `payments`, `exam_marks`, `exams`, `notices`, `homework`, `holidays`, `transport_routes`, `vehicles`, `downloads`, `student_attendance` | ✅ structurally; ⚠ attendance reads dead collection |
| POST | `/api/fees/order` → `/api/fees/confirm` | portal online payment | parent | `payment_orders` → on confirm: `payments`, `receipts`, `students`, `studentFeeSummaries`, `financeSummaries` | ◐ (gateway integration/verification signature unaudited) |
| GET/POST | `/api/admin/finance/*` (~30 routes) | `/admin/finance/*` pages | finance perms | see 04 | ◐ |
| POST | `/api/cron/create-reminder-queue`, `process-reminder-queue` | external scheduler | cron secret (verify) | `fee_reminder_settings/queue/logs`, `students`, `holidays` | ◐ — ⚠ no in-repo scheduler; without an external cron hitting these, reminders never send |
| POST | `/api/admin/erase-data`, `restore-data`, `reset-app`, `backup` | `/admin/backup` | super_admin expected | `backup_audit_logs`, `admin_audit_logs` + mass ops | ◐ — **high risk; verify requireSuperAdmin on each before production** |
| * | `/api/ai/*`, `/api/quota/*` | ai-agent pages | `lib/ai/aiPermissions.ts` | AI collections | ◐ |

## Cross-cutting API issues

1. **School/year filtering is optional query-param based** on `GET /api/admin/payments` (filters applied only if params present) — an unfiltered call returns cross-year data. Same pattern likely in sibling list endpoints. Backend does not *enforce* academic-year scoping; the client must pass it.
2. **Missing index → degraded mode** silently drops cursor pagination and reads `pageSize*3` docs (payments GET). Acceptable, but deploy `firestore.indexes.json` to avoid.
3. Response shape is consistent (`{success, data|error}`) in sampled routes; frontend callers match.
4. Unused endpoint sweep + per-route validation/auth table for all 186 routes: pending (see AUDIT-PROGRESS).
