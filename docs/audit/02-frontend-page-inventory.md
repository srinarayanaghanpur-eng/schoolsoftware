# 02 — Frontend Page Inventory

108 `page.tsx` files exist under `apps/web/app`. All are client components gated by `AuthGate` + `routeAccess.ts` (back-office roles for `/admin/*`, `teacher` for `/teacher/*`, `parent` for `/portal/*`). Status codes: **W** = connected to a real API (verified or strongly indicated by `adminApiRequest` usage), **P** = partially verified, **?** = not yet individually inspected.

## Public / auth

| Route | File | Purpose | Status |
|---|---|---|---|
| `/` | `app/page.tsx` | Redirect to role landing | P |
| `/login` | `app/login/page.tsx` + `LoginClient.tsx` | Firebase Auth login (login-id check via `/api/login-id/check`) | W |
| `/forgot-password` | `app/forgot-password/page.tsx` | Creates `password_reset_requests` via `/api/password-reset-requests` | W |
| `/unauthorized` | `app/unauthorized/page.tsx` | Access-denied screen | W |
| `/student-qr` | `app/student-qr/page.tsx` + `StudentDetailsReveal.tsx` | QR-based student detail reveal | ? |
| `/receipts/[receiptId]`, `/receipts/print/[receiptId]` | receipt view/print | Reads via receipt APIs | W |
| `/vouchers/[voucherId]`, `/vouchers/print/[voucherId]` | debit voucher view/print | W |

## Back office `/admin/*` (roles: super_admin, admin, principal, accountant, settings_manager; finance subtree restricted per `routeAccess.ts`)

Core: dashboard, students, teachers, parents, users, academic-years, settings (+`settings/academic-years`), branches, approvals, attendance (STAFF attendance), my-attendance, biometric, holidays, calendar, promotions, admission-form/[id], backup, portal.

Fees/finance: payments (fee collection), fee-structures, fee-concessions (+create), fee-reports, fee-reminders (+settings/logs/history/retry-queue), finance/{dashboard(page), collections, expenses, income, invoices, banking, cash-book, ledger, trial-balance, profit-loss, payables, receivables, dues, defaulters, installments, statements, reminders, deleted-bills, debit-vouchers, vendors, branch-accounts, receipt/[paymentId]}.

Academics: exams (+[id], [id]/hall-ticket), report-cards, homework (+[id]), timetable, certificates.

Ops: transport (+bus-finance suite, drivers, fuel-logs, daily-km, maintenance, insurance), inventory, library, hostel, messages, notices (+circulars), notifications, reports, salary, ai-agent (+settings/logs/quota).

**Verified page→API examples:**
- `admin/payments/page.tsx` → GET/POST `/api/admin/payments` (fee collection; permission-gated UI via `hasPermission(role, "fees.create")`). **W**
- `admin/attendance/page.tsx` → `/api/admin/teachers`, `/api/admin/attendance`, `/api/admin/holidays` — this is **staff** attendance. **W**
- `admin/timetable/page.tsx` → `/api/admin/timetable` (+`[id]`), full CRUD. **W**
- `admin/dashboard/page.tsx` → reads Firestore **directly from the client** (`dashboardSummaries`, `students`, `teachers`, `studentFeeSummaries`, `financeSummaries`, `payments`, `attendance`, `notifications`, `sync`) — mixed pattern; depends on Firestore rules allowing back-office roles these reads. **P**
- `admin/biometric/page.tsx` → direct client reads of `biometric_logs`, `teachers`. **P**

## Teacher portal `/teacher/*` (role: teacher)

| Route | File | Purpose | Status |
|---|---|---|---|
| `/teacher` | `app/teacher/page.tsx` | Entry/redirect | W |
| `/teacher/dashboard` | `app/teacher/dashboard/page.tsx` | Own GPS attendance (via `TeacherAttendancePanel` → `/api/attendance/mark`, data via `/api/teacher/me`), holidays, attendance % | W |
| `/teacher/salary` | `app/teacher/salary/page.tsx` | Own salary via `/api/teacher/salary` | W |

⚠️ **No teacher pages exist for: class lists, student attendance marking, homework creation, classwork, marks entry, tasks.** The "teacher daily academic workflow" has no UI.

## Parent portal `/portal/*` (role: parent — students have no login)

Pages: portal (dashboard), fees, payments (+[paymentId]), attendance, homework, exams, notices, calendar, transport, downloads, profile, contact. Each maps 1:1 to `/api/portal/*` routes (children, summary, payments, attendance, exams, notices, homework, calendar, transport, downloads, profile, messages). **W** structurally, but:

⚠️ `portal/attendance` → `/api/portal/attendance/route.ts` reads collection `student_attendance` which **nothing in the codebase writes** → page can only ever show empty data. **UI + BACKEND EXIST — DATA SOURCE NEVER POPULATED.**

## Notes

- No `/principal`, `/accountant`, `/receptionist` routes: those roles share `/admin` with RBAC-filtered menus. There is no receptionist or student role in `routeAccess.ts` at all.
- Per-page detail (buttons, dialogs, empty states) for all 108 pages is not yet exhaustively tabulated; highest-value pages are covered in `03-ui-action-map.md`. Remaining pages tracked in `AUDIT-PROGRESS.md`.
