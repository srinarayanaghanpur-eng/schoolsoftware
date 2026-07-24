# 03 — UI Action Map (verified sample of critical actions)

Status values: Fully Working / Partially Working / UI Only / Backend Only / Mock Data / Broken / Duplicate / Unused / Cannot Confirm.
"Fully Working" = complete chain UI → handler → API → Firestore verified in code (runtime not executed).

| Module | Page | UI Action | Component/File | Handler | Backend Called | Database Effect | Status |
|---|---|---|---|---|---|---|---|
| Fees | `/admin/payments` | Record Payment (form submit) | `app/admin/payments/page.tsx` | POST via `adminApiRequest` | `POST /api/admin/payments` | Transaction: `payments` + `receipts` + `students` balance + `studentFeeSummaries` + `feeAuditLogs` + `payment_idempotency` | **Fully Working** |
| Fees | `/admin/payments` | Cancel receipt | same page (`canCancelPayment`) | fetch | `POST /api/admin/finance/receipt/[paymentId]/cancel` | `payments` status update | Partially Working (balance-restore logic verified only partially — see 12) |
| Fees | `/admin/payments` | Filter/paginate payments | same page | GET with cursor | `GET /api/admin/payments` | reads `payments` (school/year/class filters, cursor, degraded-index fallback) | **Fully Working** |
| Staff attendance | `/admin/attendance` | Edit/mark staff attendance | `app/admin/attendance/page.tsx` | fetch | `GET/POST /api/admin/attendance` | `attendance` + `attendance_edit_audit_logs` + `admin_audit_logs` | **Fully Working** |
| Teacher self-attendance | `/teacher/dashboard` | GPS Check-in / Check-out | `components/TeacherAttendancePanel.tsx` | fetch | `POST /api/attendance/mark` | `attendance`, `attendance_logs` (validates `academic_years`, `teachers`) | **Fully Working** |
| Timetable | `/admin/timetable` | Add/Edit/Delete entry | `app/admin/timetable/page.tsx` | `adminApiRequest` | `/api/admin/timetable`, `/api/admin/timetable/[id]` | timetable collection | **Fully Working** |
| Students | `/admin/students` | Create/edit/deactivate student | `app/admin/students/page.tsx` | `adminApiRequest` | `/api/admin/students`, `[id]` | `students`, `counters` (admission no.), `settings`, `studentFeeSummaries` | Fully Working (structure verified) |
| Students | `/admin/students` | Bulk delete | same | fetch | `POST /api/admin/students/bulk-delete` | deletes `students` + `studentFeeSummaries` | Fully Working (super-admin gated per apiUtils pattern — confirm per-route) |
| Exams | `/admin/exams/[id]` | Enter marks | `app/admin/exams/[id]/page.tsx` | fetch | `/api/admin/exams/[id]/marks` | `exam_marks` | Fully Working (structure) |
| Exams | `/admin/exams/[id]` | Publish | same | fetch | `/api/admin/exams/[id]/publish` | `exams.published` flag | Fully Working (structure) |
| Payroll | `/admin/salary` | Generate salary report | `app/admin/salary/page.tsx` | fetch | `GET/POST /api/admin/salary` | reads `teachers`, `attendance`, `holidays`, `leave_requests`; writes `salary_reports` | Fully Working (structure) |
| Leave | admin approvals panels | Approve/reject leave | `components/TeacherLeaveRequestPanel.tsx`, `lib/leaveReview.ts` | `lib/leaveReview.ts` | `/api/admin/leave-requests` | `leave_requests`, `attendance`, audit logs | Fully Working (structure) |
| Parent portal | `/portal/attendance` | View child attendance | `app/portal/attendance/page.tsx` | fetch | `GET /api/portal/attendance` | reads `student_attendance` — **collection never written by any code** | **Broken (permanently empty)** |
| Fees (legacy) | — | `paymentService.recordPayment()` | `lib/paymentService.ts` | — | client-SDK direct write to `payments`/`receipts`/`feeAuditLogs` | duplicate of API flow, weaker guarantees | **Unused / Duplicate** |
| Fees (legacy) | — | `lib/feeService.ts`, client reads/writes of `fee_structures`, `students`, `concessions` | not imported by any `app/` page (grep) | — | — | — | **Unused (verify before delete)** |
| Dashboard | `/admin/dashboard` | Stat cards / rebuild summary | `app/admin/dashboard/page.tsx` | direct Firestore client reads + `/api/admin/sync/rebuild-dashboard-summary` | mixed | `dashboardSummaries`, `sync` | Partially Working (mixed client/server pattern; depends on rules) |
| Fee reminders | `/admin/fee-reminders/*` | Queue/process/send reminders | pages + `/api/cron/*`, `/api/admin/fee-reminder-*` | fetch | 8 reminder APIs + `lib/reminder/{whatsappProvider,smsProvider}` | `fee_reminder_queue/settings/logs`, `fee_reminders` | Cannot Confirm end-to-end (provider credentials/external delivery unverified) |
| AI agent | `/admin/ai-agent/*` | Chat, generate notice/fee message, dues summary | `components/ai/*` | fetch | `/api/ai/*` | `aiSettings`, `aiLogs`, `aiCache`, quota collections | Fully Working (structure; requires Gemini key at runtime) |

## Not yet action-mapped

Transport suite, inventory, library, hostel, certificates, report-cards, homework admin pages, notices/messages, finance sub-pages (ledger, trial-balance, P&L, banking…), promotions, backup/erase. Their APIs exist (see 05); per-button verification pending — tracked in `AUDIT-PROGRESS.md`.
