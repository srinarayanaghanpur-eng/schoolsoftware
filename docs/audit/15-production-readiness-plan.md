# 15 — Production Readiness Plan

Order is dependency-driven; business-critical flows before polish. "Verify" = read/execute code before changing anything.

## Phase 0 — Prevent data loss & security problems
| Priority | Task | Files | Completion criteria |
|---|---|---|---|
| P0 | Run `npm run check:admin-api-auth`; fix any route missing an auth helper | `scripts/check-admin-api-auth.js`, all 186 routes | script passes; every route calls requireXxx |
| P0 | Verify `requireSuperAdmin` on erase-data/reset-app/restore-data/backup, bulk-delete | those routes | confirmed + double-confirm UI |
| P0 | Delete dead client-write libs (`lib/paymentService.ts`, `lib/feeService.ts`, confirm `concessionService.ts`) | lib/ | no client-SDK financial writes remain |
| P0 | Verify receipt-cancel reverses student balance + summaries; fix if not | `api/admin/finance/receipt/[paymentId]/cancel`, `lib/feeRecalculation.ts` | cancel → balances restored in one transaction |
| P0 | Deploy `firestore.indexes.json` covering payments filters (kill degraded mode); review `firestore.rules` against actual client-read pages (dashboard, biometric) | root configs | no FAILED_PRECONDITION fallbacks in logs |

## Phase 1 — Auth, roles, academic year
Force token refresh on role change (or accept 1h lag consciously); single academic-years page (remove duplicate); define year "close" semantics; make `academicYearId` **required** on all fee/attendance writes and default-enforced on list APIs.

## Phase 2 — Student master data
Verify fee-structure assignment at admission end-to-end; unify parent-linking (choose `users`-based or `parent_student_links`, migrate the other); build CSV bulk import (students+parents+fee assignment) — schools cannot onboard without it.

## Phase 3 — Fees & finance hardening
Single recalculation entry point for all fee mutations (payments ✅, concessions verify, installments verify); reconcile `students` vs `studentFeeSummaries` (make one derived); runtime QA of payment flow incl. cancel/re-collect; wire fee-reminder scheduler + provider credentials, collapse the two reminder UIs; verify online-payment gateway signature in `fees/confirm`.

## Phase 4 — Student attendance (build from scratch) 🔴
Teacher UI: my classes → roster → mark/present/absent/late → submit; API `POST /api/teacher/student-attendance` writing `student_attendance` (docId `{classId}_{sectionId}_{date}` for duplicate prevention); admin oversight page; make `/portal/attendance` come alive; absence notification hook. This unblocks the broken parent page.

## Phase 5 — Teacher academic workflow + principal monitoring
Teacher: classes/timetable view, homework/classwork authoring, marks entry (scoped to own subjects); Principal: daily submissions dashboard, approve/reject (reuse `lib/approvalEngine.ts` with a new request type).

## Phase 6 — Payroll completion
Wire `salary_advances` → deduction in `/api/admin/salary` calc; approval + lock of generated months; payslip PDF.

## Phase 7 — Exams polish
Max-marks validation server-side in marks route; grade bands; report-card templates + PDF; hall-ticket QA.

## Phase 8 — Parent portal & notifications
Push (FCM) registration + payment/absence/notice events; unify `notifications` vs `admin_notifications`; portal attendance goes live (dep: Phase 4).

## Phase 9 — Reports, exports, audit-log viewer
Merge reports hubs; server-side export for big tables; admin UI over `audit_logs`/`feeAuditLogs`/`admin_audit_logs`.

## Phase 10 — UX/mobile/perf/final QA
Finance IA consolidation (daily open→collect→spend→close flow); global student search → profile → collect shortcut; run existing Playwright suite against emulator + fix; Lighthouse pass; audit `apps/mobile` & `apps/desktop` parity; remove console noise.
