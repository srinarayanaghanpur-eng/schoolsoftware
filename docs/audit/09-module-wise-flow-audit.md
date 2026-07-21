# 09 — Module-wise Flow Audit

Readiness scale: Ready / Mostly Ready / Partially Ready / Major Work Required / UI Prototype Only / Not Implemented / Unsafe for Production.

| # | Module | Frontend | Backend | DB | Verdict / key problem |
|---|---|---|---|---|---|
| 1 | Authentication | `/login`, forgot-password | Firebase Auth, `verifyBearerToken`, claims sync (`lib/authClaims.ts`) | `users` | **Mostly Ready** — claim-lag (~1h) on role change; document or force token refresh |
| 2 | User management | `/admin/users` | users APIs | `users` | **Mostly Ready** |
| 3 | Roles/permissions | RBAC matrix in shared + `rbacAdmin`, `routeAccess` | `requirePermission` server-side | `roles` (AI perms) | **Mostly Ready** — verify every one of 186 routes calls a helper (`check:admin-api-auth` script exists; run it) |
| 4 | School/branch mgmt | `/admin/branches` | branches API | `branches` | **Partially Ready** — branch filtering optional on most list APIs |
| 5 | Academic year | 2 pages (duplicate) | academic-years + activate | `academic_years` | **Partially Ready** — no year-close/rollover procedure |
| 6 | Class & section | inside settings + class-sections API (+merge) | ✅ | `settings`, `students` | **Mostly Ready** |
| 7 | Student admission | `/admin/students`, admission-form/[id] | students API (counters for admission no.) | `students` | **Partially Ready** — enquiry stage absent; fee assignment at admission to verify |
| 8 | Student management | `/admin/students` | full CRUD + bulk delete | `students`, `studentFeeSummaries` | **Mostly Ready** |
| 9 | Parent management | `/admin/parents` | parents APIs + reset-password | `users`, `students` | **Mostly Ready** — dual linking mechanisms (see 06) |
| 10 | Teacher management | `/admin/teachers` | teachers APIs | `teachers`, `users` | **Mostly Ready** |
| 11 | Staff attendance | `/admin/attendance`, `/teacher/dashboard`, biometric | mark/admin/biometric APIs, GPS validation | `attendance` + logs | **Mostly Ready** — best non-finance module |
| 12 | **Student attendance** | portal view only | portal read API only | `student_attendance` (never written) | **Not Implemented** 🔴 — no marking UI/API at all |
| 13 | Leave management | teacher panel + admin review | leave APIs + `leaveReview` (attendance sync) | `leave_requests` | **Mostly Ready** |
| 14 | Fee structure | `/admin/fee-structures` | API | `fee_structures` | **Mostly Ready** — delete duplicate client lib |
| 15 | Fee assignment | via student fee heads (`feeHeads` on student) | students API | `students` | **Partially Ready** — assignment-at-admission flow to verify |
| 16 | Fee collection | `/admin/payments` | transactional POST w/ idempotency | payments set | **Ready (code-level)** — needs runtime QA |
| 17 | Concessions | `/admin/fee-concessions` | concessions API | `concessions` | **Mostly Ready** — recalc of totals after concession change to verify (see 12) |
| 18 | Advance payments | overpayment guard via `validatePaymentAllowed` | — | — | **Partially Ready** — no explicit advance/credit ledger for fees |
| 19 | Receipts | receipt pages + APIs, tx counter | ✅ | `receipts`, `receipt_counters` | **Ready (code-level)** |
| 20 | Expenses | `/admin/finance/expenses` | API | `expenses` | **Mostly Ready** |
| 21 | Finance dashboard | `/admin/finance` + dashboard-stats | summary APIs + `financeSummaries` | multiple | **Partially Ready** — per-request collection scans; summary drift risk |
| 22 | Payroll | `/admin/salary` | salary API (attendance+holidays+leave inputs) | `salary_reports` | **Partially Ready** — advance deduction link unverified; no payslip PDF found |
| 23 | Salary advances | finance advances API | writer/reader chain unclear | `salary_advances` | **Partially Ready / verify** |
| 24 | Exams | `/admin/exams` | exams APIs | `exams` | **Mostly Ready** |
| 25 | Marks entry | `/admin/exams/[id]` (admin-side only) | marks API | `exam_marks` | **Partially Ready** — teachers cannot enter marks |
| 26 | Report cards | `/admin/report-cards` + report-card API + hall tickets | ◐ | exam data | **Partially Ready** |
| 27 | Homework | `/admin/homework` + portal view + submission grading | APIs exist | `homework`, `homework_submissions` | **Partially Ready** — no teacher UI; who submits `homework_submissions`? parents have view-only — submission writer to verify |
| 28 | Classwork | — | — | — | **Not Implemented** |
| 29 | Teacher tasks | — | — | — | **Not Implemented** |
| 30 | Principal approvals (academic) | generic `approval_requests` engine exists (`lib/approvalEngine.ts`, `/admin/approvals`) | ✅ engine | `approval_requests` | **Partially Ready** — engine is generic (student/payment edits), not academic-task approvals |
| 31 | Notifications | `/admin/notifications` | API | `notifications`/`admin_notifications` | **Partially Ready** — in-app only; no push/FCM; overlapping collections |
| 32 | Messages | `/admin/messages`, portal messages | APIs | via users/students | **Partially Ready** |
| 33 | Transport | full admin suite + bus finance + portal view | ~15 APIs | 7 collections | **Mostly Ready (structure)** |
| 34 | Reports | `/admin/reports`, fee-reports + 7 report APIs | ✅ | reads summaries/payments | **Mostly Ready** |
| 35 | Bulk import | — (no import UI/API found; only test seeders) | — | — | **Not Implemented** — schools need CSV student import |
| 36 | Export | `components/ExportButtons.tsx` (xlsx dep present) | client-side | — | **Partially Ready** |
| 37 | Settings | `/admin/settings` | class-sections, gps, UPI, admission approval settings components | `settings` | **Mostly Ready** |
| 38 | Audit logs | writers everywhere (`audit_logs`, `admin_audit_logs`, `feeAuditLogs`, `attendance_edit_audit_logs`, `backup_audit_logs`) | ⚠ almost no reader UI (only deleted-bills reads `audit_logs`) | 5 log collections | **Partially Ready** — logs written but not viewable |
| 39 | Parent portal | 13 pages ↔ 13 APIs | ✅ | see 06 | **Mostly Ready** except attendance (broken) and push notifications |
| 40 | Teacher mobile/portal UI | `/teacher/*` (3 pages) + `apps/mobile` (not audited) | ✅ for HR functions | — | **Partially Ready** — HR-only; academic functions missing |
