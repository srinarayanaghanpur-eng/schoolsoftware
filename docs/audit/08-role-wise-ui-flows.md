# 08 — Role-wise UI Flows

Roles actually implemented (`routeAccess.ts` + `apiUtils.ts`): `super_admin`, `admin`, `principal`, `accountant`, `settings_manager`, `teacher`, `parent`. **No `receptionist` role, no `student` login** — students are represented only as data; parents view on their behalf.

## Super Admin / Admin
Login → `/admin/dashboard` → full sidebar (AppShell filters by RBAC matrix `modulesForRole`).
- Manage users/roles (`/admin/users` → users API → claims) — **Complete**
- Students, teachers, parents CRUD — **Complete**
- Fees: structures, concessions, collection, receipts, reports — **Complete** (server-verified)
- Finance suite, payroll, backup/erase (super only for destructive ops — verify per route) — **Complete/Partial**
- Academic years incl. activate — **Complete**; year-end promotion — **Partial** (fee carry-forward unproven)
- Student attendance oversight — **Missing** (module doesn't exist)
- Approvals (`/admin/approvals` → `approval_requests` engine) — **Complete (structure)**

## Principal
Shares `/admin` with BACK_OFFICE_ROLES but is **blocked** from `/admin/finance`, `/admin/fee-reminders`, `/admin/settings` (per `routePermissions`). 
- Daily monitoring: dashboard, staff attendance, approvals, exams, homework oversight — **Partial**
- ⚠ There is **no dedicated teacher-task / teaching-completion / principal-approval academic workflow** anywhere in the code (no collections, no APIs). The "Teacher submits work → Principal approves" chain from the requirements is **Not Implemented**.

## Accountant
`/admin` + `/admin/finance` + `/admin/fee-reminders`. Fee collection → receipt chain **Complete**. Expense/income/vendor/purchase entry **Complete (structure)**. Daily closing (`finance/daily/closing`) **exists**.

## Settings Manager
`/admin/settings`, `/admin/settings/academic-years` + general back-office. **Complete** for settings CRUD.

## Teacher
Login → `/teacher/dashboard`.
1. GPS check-in/out → `/api/attendance/mark` — **Complete**
2. View own attendance calendar/percentage — **Complete**
3. Request leave (`TeacherLeaveRequestPanel` → `/api/leave-requests`) — **Complete**
4. View salary/payslip data (`/teacher/salary`) — **Complete**
5. Request password reset — **Complete**
6. Mark student attendance — **Missing (no UI, no API)**
7. View own classes/timetable — **Missing**
8. Create homework/classwork, upload activity — **Missing** (homework is admin-side only)
9. Enter marks — **Missing** (marks entry is admin-side)
10. Receive/complete principal tasks — **Missing**

The teacher portal is an **HR self-service portal**, not an academic portal.

## Parent
Login → `/portal` → child selector (`PortalChildContext`, `/api/portal/children`).
- Fees & dues, payment history, receipt download — **Complete**
- Online payment (order/confirm) — **Partial** (gateway integration unverified)
- Exams/marks (published only) — **Complete**
- Homework view — **Complete** (but only if admin enters homework)
- Notices, calendar, transport, downloads, profile, contact — **Complete (structure)**
- Attendance — **Broken**: page + API exist, data source never written
- Notifications/push — **Missing** (no FCM/push registration found)

## Logout
`AuthProvider.signOutAndClear` + `AutoLogoutProvider` (idle logout) — present for all roles.
