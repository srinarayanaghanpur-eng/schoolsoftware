# C3 Scope Decision — Parent Data Model

- Date: 2026-10-31
- Operator: Engineering
- Gate: C3 (Student master data and onboarding)
- Status: Decided, implementation pending

## Decision

Two distinct layers, no dual-write of identity:

1. **Student family/contact fields are authoritative for documents.**
   The `students` document owns `fatherName`, `motherName`, `guardianName`,
   `fatherPhone`, `motherPhone`, and the display fallbacks `parentName` /
   `parentMobile`. Receipts, certificates, ID cards, fee reminders, and QR pages
   read these fields.

2. **`parent_student_links` is the only account-linkage model.**
   A parent portal account (`users` doc with `role: "parent"`) is linked to a
   student through `parent_student_links` (`parentUid`, `studentId`,
   `relationship`, `isPrimary`). No `parentId` or `parentUid` is stored on the
   student document.

## Evidence

| Check | Result |
|---|---|
| Portal auth resolves students via `parent_student_links` | `lib/portalHelpers.ts:47-55` |
| Link/unlink helpers use only the links collection | `lib/parentStudentLink.ts` |
| Admin parent pages manage links, not student fields | `app/api/admin/parents/[parentId]/links/route.ts` |
| No `parentId` / `parentUid` written on students | Grep of `app/api/admin/students/**` found none |
| Student create/update persists `fatherName`, `motherName` | `app/api/admin/students/route.ts:315,318`, `[id]/route.ts:154,157` |
| Receipts read student contact fields with fallbacks | `lib/receiptService.ts:210-211` |
| Bulk import writes `fatherPhone` only | `app/api/admin/settings/bulk-upload/route.ts:277,297` |

## Display precedence

- Name: `parentName` → `fatherName` → `motherName` → `guardianName`
- Mobile: `parentMobile` → `fatherPhone` → `phone` → `motherPhone`

This matches the existing receipt fallback chain, so no display code changes are
required.

## Remaining C3 work

1. ~~Extend bulk import so parent columns populate the student contact fields.~~
   Done: `uploadStudents` now reads `fatherName`, `motherName`, `guardianName`,
   `fatherPhone`, `motherPhone`, `parentName`, and `parentMobile`
   (`app/api/admin/settings/bulk-upload/route.ts:277-284,304`).
2. When linking a parent account, backfill **missing** student contact fields
   from the parent `users` doc. Never overwrite a non-empty student value.
3. Add a consistency check to the import dry-run: a student with no mobile in
   either layer is reported as an error row.
4. Document that parent account `displayName` / `phone` are not the source of
   truth for receipts.

## Explicit non-goals

- No automatic parent account creation from a student record.
- No reverse sync from student fields into `users`.
- No `parentId` field on students.

## Result

Decision recorded. C3 remains open until the bulk-import and backfill work above
is implemented and tested.
