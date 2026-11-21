# Mobile Redesign Parity Map

Maps the current Expo/React Native screens to the redesign demo screens. Status
values: **Keep** (carry as-is), **Merge** (fold into another demo screen),
**Redesign** (same screen, needs rework), **Missing** (no demo counterpart).

Demo screen names are limited to: Login, Teacher Home, Teacher Attendance,
Teacher Academics, Parent Home, Parent Fees, Parent Exams, Admin Home,
Admin Students, Admin Attendance, Inbox, Profile.

## 1. Screen parity

| Existing RN route / screen | What it does | Demo screen | Status | Notes |
|---|---|---|---|---|
| `app/login.tsx` | Firebase sign-in, role routing, remember/forgot, dark toggle | Login | Keep | Auth logic unchanged; already rebuilt to reference spec |
| `app/teacher/index.tsx` | Greeting, check-in hero, tasks, stats, notices, quick actions | Teacher Home | Keep | Attendance/tasks/calendar live; timetable section is an honest empty state |
| `app/teacher/attendance.tsx` | GPS check-in/out, selfie, offline retry, month calendar | Teacher Attendance | Keep | All marking logic lives in `useAttendanceMarking` |
| `app/teacher/academics.tsx` | Assignment, month progress, homework, exam links, calendar | Teacher Academics | Redesign | Timetable, syllabus progress and homework-to-review are placeholders |
| `app/teacher/history.tsx` | Month-to-date attendance list with filters | Teacher Attendance | Merge | Fold history into Teacher Attendance; also linked from Profile |
| `app/teacher/homework.tsx` | Post homework and list recently posted | Teacher Academics | Merge | Posting is live; demo should reach it from Academics |
| `app/teacher/exams.tsx` | Stub "timetable view only" | Teacher Academics | Missing | No real exam data; must not be shown as a working module |
| `app/teacher/tasks.tsx` | Tasks assigned by principal; mark done | Teacher Home | Merge | Home already previews open tasks |
| `app/teacher/inbox.tsx` | Staff notices read from school calendar | Inbox | Merge | Read-only; no message threads |
| `app/teacher/profile.tsx` | Identity, details, history link, logout | Profile | Keep | Shared logout confirmation pattern |
| `app/parent/index.tsx` | Child switcher, fees due, receipts, homework, notices | Parent Home | Keep | Live `/api/portal/summary` |
| `app/parent/fees.tsx` | Fee summary, payment history, shareable receipts | Parent Fees | Keep | Summary plus `/api/portal/payments` |
| `app/parent/attendance.tsx` | Month attendance, day list, present/absent/late | Parent Home | Missing | Student attendance deferred (C5-02); keep informational, no daily records |
| `app/parent/homework.tsx` | Homework list per child | Parent Home | Merge | Home already surfaces due homework |
| `app/parent/hall-ticket.tsx` | Published exams and hall tickets | Parent Exams | Keep | Read-only; no results publication |
| `app/parent/messages.tsx` | Notices read side plus compose to school | Inbox | Redesign | Compose is live; no inbox GET, so no two-way thread |
| `app/parent/profile.tsx` | Children, receipts, push prefs, menu, logout | Profile | Keep | Push preference toggles are live |
| `app/admin/index.tsx` | Collections hero, KPIs, approvals, recent payments | Admin Home | Keep | Live `/api/admin` dashboard |
| `app/admin/students.tsx` | Paged student search grouped by class | Admin Students | Keep | Due badges and search live |
| `app/admin/student/[id].tsx` | Student detail, fees, contacts, payments | Admin Students | Merge | Nested detail under Students |
| `app/admin/staff.tsx` | Staff directory plus today's attendance KPIs | Admin Attendance | Merge | Attendance snapshot should seed the demo attendance screen |
| `app/admin/staff/[id].tsx` | Staff detail plus monthly attendance | Admin Attendance | Merge | Read-only; corrections stay in the office web app |
| `app/admin/fees.tsx` | Collections, finance position, receipts | Admin Home | Merge | No dedicated demo finance screen |
| `app/admin/dues.tsx` | Outstanding dues grouped by class | Admin Students | Merge | Dues drill into student detail |
| `app/admin/receipt/[id].tsx` | Receipt detail and share link | Admin Students | Merge | Reached from student/payment history |
| `app/admin/exams.tsx` | Admin exam CRUD | Admin Home | Missing | No demo counterpart; timetables may be unpublished |
| `app/admin/expenses.tsx` | Expenses and cash book | Admin Home | Missing | No demo finance screen for expenses |
| `app/admin/approvals.tsx` | Leave and change approvals | Admin Home | Missing | Only a pending-approvals preview exists on Home |
| `app/admin/notices.tsx` | Notice create/edit/delete | Inbox | Merge | Management side of Inbox |
| `app/admin/tasks.tsx` | Assign tasks to teachers | Admin Home | Missing | No demo counterpart; referenced from Staff |
| `app/admin/profile.tsx` | Role-aware stats, links, logout | Profile | Keep | Reused by principal/accountant workspaces |
| `app/{teacher,parent,admin}/_layout.tsx` | Role guards and stack/shell chrome | — | Keep | Not demo screens; keep auth and role gating |
| `features/admin/featureScreens/StudentSearchScreen.tsx` | Body of Students search | Admin Students | Keep | Extracted implementation of the route |
| `features/admin/featureScreens/StudentDetailScreen.tsx` | Body of student detail | Admin Students | Merge | Extracted implementation of the route |
| `features/admin/featureScreens/StaffDetailScreen.tsx` | Body of staff detail and attendance | Admin Attendance | Merge | Extracted implementation of the route |
| `features/admin/featureScreens/ReceiptDetailScreen.tsx` | Body of receipt detail | Admin Students | Merge | Extracted implementation of the route |
| `features/admin/featureScreens/DuesListScreen.tsx` | Body of dues list | Admin Students | Merge | Extracted implementation of the route |
| `features/admin/featureScreens.tsx` | Barrel re-export of the five screens above | — | Keep | Not a screen |

## 2. Stubbed or placeholder features (do NOT show as complete)

| Feature | Where | Current state | Demo rule |
|---|---|---|---|
| Teacher timetable | `teacher/index`, `teacher/academics` | EmptyState, no mobile endpoint | Show as pending, never a populated timetable |
| Teacher syllabus progress | `teacher/academics` | EmptyState ("next school release") | Do not show progress bars or data |
| Teacher homework-to-review | `teacher/academics` | EmptyState | Do not claim a review queue exists |
| Teacher exams | `teacher/exams` | Stub "timetable view only" | Do not present as a working exam module |
| Exam timetables | `admin/exams`, `parent/hall-ticket` | Papers may be empty; "not published yet" | Show only published papers, never invent schedules |
| Parent attendance | `parent/attendance` | Informational; student attendance deferred (C5-02) | Never show daily records or absence alerts |
| Parent messages | `parent/messages` | Compose-only; no inbox GET | Do not show two-way chat threads |
| Teacher inbox | `teacher/inbox` | Read-only calendar notices | Do not imply replies or unread counts |
| Parent timetable tile | `parent/index` | Opens `/portal/calendar` on the website | Mark as a web hand-off, not native |

## 3. Backend connections the demo must imply but not fake

- **Attendance config/mark** — `/api/teacher/attendance*` (check-in/out, geofence/proximity, selfie requirement, offline retry) must read as server-verified. Do not fake a live geofence or a bypass record.
- **Staff attendance** — admin dashboard and staff endpoints (`useTodayAttendance`, `fetchTeacherAttendanceSummary`) imply staff-only attendance. There is no student roll call.
- **Portal summary/payments** — `/api/portal/summary`, `/api/portal/payments` and receipt endpoints are scoped by `parent_student_links`. Show values, do not fake new payment flows.
- **Portal homework/exams** — `/api/portal/homework` and exam/hall-ticket endpoints are read-only. Do not imply teacher review or result publication beyond what exists.
- **Admin dashboard/students** — `/api/admin` stats, student search/detail, dues and staff directory are server-RBAC-scoped. Imply auth and role gates, not client-held data.
- **Notices/tasks** — admin notice and task endpoints are live. Do not fake absence notifications, payroll, or messaging outside this scope.
