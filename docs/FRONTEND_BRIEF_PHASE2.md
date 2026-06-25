# Frontend Brief — Phase 2 (Exams & Marks + Communication)

> For Codex. Same rules as Phase 1: **UI only**, don't touch `apps/web/app/api/**`,
> `apps/web/lib/**`, or `packages/shared/**`. Import types from `@sri-narayana/shared`.
> All `/api/admin/**` calls need `Authorization: Bearer <firebase idToken>` (see Phase 1 brief).

## Shared types now available
```ts
Exam, ExamType, ExamStatus, ExamMark           // exams
Notice, NoticeChannel                          // communication
examCreateSchema, examMarkEntrySchema, examMarksBulkSchema, noticeCreateSchema  // zod
```
Permissions used (already in RBAC): `exams.view/create/edit/approve/delete`, `communication.view/create`.
Gate the nav/buttons with `hasPermission(role, "...")`.

---

## Module A — Exams & Marks  (`/admin/exams`)

### API contracts (all live & tested)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/admin/exams?academicYearId=&className=` | — | `{ ok, exams: Exam[] }` (newest first) |
| POST | `/api/admin/exams` | `{ name, academicYearId, className, section?, examType, startDate, endDate?, maxMarks }` | `{ ok, id }` |
| GET | `/api/admin/exams/[id]` | — | `{ ok, exam }` |
| PATCH | `/api/admin/exams/[id]` | partial exam | `{ ok }` |
| DELETE | `/api/admin/exams/[id]` | — | `{ ok, deletedMarks }` (also removes its marks) |
| GET | `/api/admin/exams/[id]/marks` | — | `{ ok, marks: ExamMark[] }` |
| POST | `/api/admin/exams/[id]/marks` | `{ marks: [{ studentId, subject, marksObtained, maxMarks, grade?, remarks? }] }` | `{ ok, saved }` — **upsert** by student+subject |
| POST | `/api/admin/exams/[id]/publish` | — | `{ ok }` (status → `published`; needs `exams.approve`) |

`examType`: `unit_test | midterm | final | olympiad | other`.
`status`: `scheduled | ongoing | completed | published`.

### Screens to build
1. **Exam list / schedule** — table of exams (name, class+section, type, date, max marks, status badge).
   Filter by the **active academic year** (use the year switcher context) and by class.
   "Create Exam" form (validate with `examCreateSchema`).
2. **Marks entry grid** — pick an exam → a grid of students (rows) × subjects (or single subject)
   to type marks. "Save" posts the whole grid to the bulk marks endpoint. Show saved/updated state.
   (Student list comes from the existing `students` data — fetch what you already use on the Students page.)
3. **Results / report** — per exam, show entered marks, totals, grades; a **Publish** button
   (only for `exams.approve` roles) that calls `/publish`. Published results are what parents/students see.

---

## Module B — Communication  (`/admin/notices` or extend the existing notifications page)

### API contracts (live & tested)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/admin/notices` | — | `{ ok, notices: Notice[] }` (newest first) |
| POST | `/api/admin/notices` | `{ title, body, audienceRoles?, audienceClasses?, channels?, academicYearId? }` | `{ ok, id, pendingChannels }` |
| PATCH | `/api/admin/notices/[id]` | partial | `{ ok }` |
| DELETE | `/api/admin/notices/[id]` | — | `{ ok }` |

- `channels`: `["app"]` default. `app` shows in-app immediately; `sms`/`whatsapp`/`email` are
  **recorded** (returned in `pendingChannels`) but actual sending is a later provider integration —
  show them as "queued", not "sent".
- `audienceRoles` empty = everyone; `audienceClasses` empty = all classes.

### Screens to build
1. **Notice board / circulars list** — cards/table of notices (title, audience, channels, date).
2. **Compose notice** — title, body (textarea), **audience picker** (multi-select roles + classes),
   **channel toggles** (App / SMS / WhatsApp / Email — App on by default). Validate with `noticeCreateSchema`.
3. **Show pending channels** — after posting, indicate which external channels are "queued for delivery".

---

## Backend status for Phase 2 — ✅ ALL DONE & TESTED
- ✅ Exam + ExamMark + Notice models & schemas in `@sri-narayana/shared`
- ✅ Exams CRUD + bulk marks upsert + publish
- ✅ Notices CRUD (with channel bookkeeping)
- ✅ Firestore rules for `exams`, `exam_marks`, `notices`
- ✅ Typecheck passes; every endpoint verified with a real admin token

Ping me when Phase 2 UI is wired → I'll start **Phase 3 (online fee payment, HR/payroll, parent/student portal APIs)**.
