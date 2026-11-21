# Gate C5 — Attendance scope decision

- Commit: working tree (uncommitted at decision time)
- Date: 2026-10-31
- Operator: Engineering
- Environment: local
- Related gate owner: Product Owner

## Decision

**Defer student attendance.** Daily student attendance is not part of this
readiness effort. The owner confirmed it does not need to be built now.

## Rationale

- No writer exists for `student_attendance`; the parent portal read is orphaned.
- The module is a new build (teacher roster, API, admin oversight, parent view),
  not a fix, and would expand C6 and C7 by an estimated 2-4 weeks.
- Staff attendance, fees, payroll, and exams are the release-critical flows.

## Actions taken

| Action | File | Status |
|---|---|---|
| Remove Attendance from parent portal desktop nav | `apps/web/components/AppShell.tsx` (`portalNav`) | Done |
| Remove Attendance from parent portal mobile nav | `apps/web/components/AppShell.tsx` (`mobileNav`) | Done |
| Remove Attendance from portal subnav | `apps/web/components/PortalSubnav.tsx` | Done |
| Replace the empty attendance table with an explicit not-available notice | `apps/web/app/portal/attendance/page.tsx` | Done |
| Leave the API route dormant (no caller) | `apps/web/app/api/portal/attendance/route.ts` | Dormant |

The API route is intentionally not deleted: it is the future integration point
and is unreachable from the UI. It returns an empty result, not an error.

## Effects on other gates

- C6: absence notifications are **out of scope**. C6.4 covers payment and notice
  events only.
- C7: the UAT attendance cycle covers **staff attendance only**. Student
  attendance is not tested.

## Manual checks

| Check | Result | Notes |
|---|---|---|
| Parent portal nav has no Attendance link | PASS | Removed from `portalNav`, `mobileNav`, `PortalSubnav` |
| `/portal/attendance` shows a clear notice | PASS | Page rewritten |
| No UI caller of `/api/portal/attendance` remains | PASS | Only the page called it; page no longer does |
| Staff attendance unaffected | PASS | `/admin/attendance`, `/admin/my-attendance` untouched |

## Verification limits

Typecheck, lint, and build were **not run** at decision time because the operator
requested no Node commands. The change is a nav removal and a static page; it
must still be confirmed in C0/C7.

## Defects raised

None.

## Result

PASS (decision and deferral implemented; build verification deferred to C0)

## Sign-off

- Name / role: Product Owner (decision owner)
- Date: 2026-10-31
- Approval reference: conversation decision "no need to build the student attendance"
