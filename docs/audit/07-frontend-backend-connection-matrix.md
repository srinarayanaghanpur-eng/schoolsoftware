# 07 — Frontend ↔ Backend Connection Matrix

Legend: ✅ complete chain verified in code · ◐ chain exists, details pending · 🔴 broken/missing link.

| Module | Frontend Route | Handler → Backend | Collections | Connection | Problem |
|---|---|---|---|---|---|
| Login | `/login` | Firebase Auth + `/api/login-id/check` | `users`, `teachers` | ✅ | — |
| Fee collection | `/admin/payments` | POST `/api/admin/payments` | `payments`,`receipts`,`students`,`studentFeeSummaries`,`payment_idempotency`,`feeAuditLogs`,`financeSummaries` | ✅ | best-built flow in the app (transaction + idempotency + tx receipt counter) |
| Receipt view/print | `/receipts/[id]`, `/admin/finance/receipt/[paymentId]` | receipt APIs | `receipts`,`payments` | ✅ | — |
| Receipt cancel | payments page | `/api/admin/finance/receipt/[paymentId]/cancel` | `payments` | ◐ | confirm balance + summary reversal (see 12) |
| Online fee payment | `/portal/fees` | `/api/fees/order` → `/api/fees/confirm` | `payment_orders`→payment set | ◐ | gateway signature verification unaudited |
| Students | `/admin/students` | `/api/admin/students*` | `students`,`counters`,`settings`,`studentFeeSummaries` | ✅ | — |
| Admission form | `/admin/admission-form/[id]` | students API | `students` | ◐ | fee-structure assignment step needs verification |
| Teachers | `/admin/teachers` | `/api/admin/teachers*` | `teachers`,`users` | ✅ | — |
| Parents | `/admin/parents` | `/api/admin/parents*` | `users`,`students` | ✅ | dual link mechanism vs `parent_student_links` |
| Users/roles | `/admin/users` | `/api/admin/users*` | `users` | ✅ | claim refresh lag up to ~1h (documented in rules) |
| Academic years | `/admin/academic-years`, `/admin/settings/academic-years` | `/api/admin/academic-years*` (+activate) | `academic_years` | ✅ | two pages for the same module (duplicate UI) |
| Staff attendance | `/admin/attendance` | `/api/admin/attendance` | `attendance` + audit logs | ✅ | — |
| Teacher GPS check-in | `/teacher/dashboard` | `/api/attendance/mark` | `attendance`,`attendance_logs` | ✅ | — |
| Biometric | `/admin/biometric` + device | `/api/biometric/*` | `biometric_logs`→`attendance` | ◐ | device auth mechanism to verify |
| **Student attendance** | `/portal/attendance` (view only) | `/api/portal/attendance` | `student_attendance` | 🔴 | **No marking UI, no writing API — collection never written. Chain: Parent page → API → empty collection. Last working point: API executes and returns [].** |
| Leave | teacher panel + admin | `/api/leave-requests`, `/api/admin/leave-requests`, `lib/leaveReview.ts` | `leave_requests`,`attendance` | ✅ | — |
| Payroll | `/admin/salary` | `/api/admin/salary` | `salary_reports` ← `attendance`,`holidays`,`leave_requests` | ◐ | advance-deduction link to `salary_advances` unverified |
| Salary advances | `/admin/finance` area | `/api/admin/finance/advances` | `salary_advances`(?) | ◐ | writer/read chain unclear — flagged |
| Teacher salary view | `/teacher/salary` | `/api/teacher/salary` | `salary_reports` | ✅ | — |
| Exams | `/admin/exams`,`[id]` | `/api/admin/exams*` | `exams`,`exam_marks` | ✅ | — |
| Report cards | `/admin/report-cards` + exam report-card API | `exams`,`exam_marks`,`students` | ◐ | template/publish flow to verify |
| Parent exam view | `/portal/exams` | `/api/portal/exams` | `exam_marks`,`exams` (published filter) | ✅ | — |
| Homework | `/admin/homework` (+grading) / `/portal/homework` | homework APIs | `homework`,`homework_submissions` | ◐ | ⚠ teachers have no homework UI — admin-entered only |
| Timetable | `/admin/timetable` | `/api/admin/timetable*` | timetable | ✅ | no teacher/parent view of timetable |
| Fee structures | `/admin/fee-structures` | `/api/admin/fee-structures*` | `fee_structures` | ✅ | duplicate client lib exists |
| Concessions | `/admin/fee-concessions` | `/api/admin/concessions*` | `concessions`,`students`,`feeAuditLogs` | ✅ | duplicate client lib exists |
| Promotions | `/admin/promotions` | `/api/admin/promotions*` | `students`,`promotions` | ◐ | fee carry-forward on promotion to verify (see 10-G) |
| Finance suite | `/admin/finance/*` | ~30 finance APIs | payments/incomes/expenses/… | ◐ | totals computed per-request by scanning collections (cost + consistency) |
| Fee reminders | `/admin/fee-reminders/*` | reminder APIs + `cron/*` | reminder collections | 🔴/◐ | **no scheduler in repo** — cron endpoints exist but nothing calls them; WhatsApp/SMS providers need credentials |
| Dashboard | `/admin/dashboard` | direct client reads + rebuild API | `dashboardSummaries`,`sync`,… | ◐ | mixed client/server access pattern |
| Notices/messages/notifications | `/admin/notices` etc., portal | respective APIs | `notices`,`admin_notifications`,`notifications` | ◐ | three overlapping notification collections |
| Transport/inventory/library/hostel | `/admin/*` | respective APIs | respective collections | ◐ | structure exists end-to-end; per-button verification pending |
| AI agent | `/admin/ai-agent/*` | `/api/ai/*` | AI collections | ✅ | needs Gemini API key at runtime |
| Backup/erase | `/admin/backup` | backup/erase/restore/reset APIs | audit logs + mass ops | ◐ | **verify super_admin gating before any real data exists** |
