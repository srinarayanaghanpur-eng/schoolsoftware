# Readiness Gate Dashboard

This folder holds the evidence, defect register, deferral register, UAT record,
and final sign-off for the core readiness plan
(`docs/CORE_READINESS_PLAN.md`).

Rule: a gate is PASS only when its evidence file exists, is signed by the
accountable role, and links to a CI run or pasted command output.

## Gate status

| Gate | Name | Accountable | Status | Commit | Evidence |
|---|---|---|---|---|---|
| C0 | Baseline and freeze | Engineering Lead | Not started | — | `evidence/C0-baseline.md` |
| C1 | Security and data safety | Security Lead | In progress | — | `evidence/C1-security.md` |
| C2 | Auth, roles, academic year | Backend Lead | Not started | — | `evidence/C2-auth-year.md` |
| C3 | Student master and onboarding | Backend Lead | Not started | — | `evidence/C3-student-master.md` |
| C4 | Fees and finance integrity | Finance/Backend Lead | Not started | — | `evidence/C4-fee-integrity.md` |
| C5 | Attendance scope decision | Product Owner | PASS | — | `evidence/C5-scope-decision.md` |
| C6 | Payroll, exams, reminders, notifications | Engineering Lead | Not started | — | `evidence/C6-modules.md` |
| C7 | UAT and sign-off | QA Lead | Not started | — | `evidence/C7-uat.md` |

Status values: Not started, In progress, Blocked, PASS, FAIL.

## Files

| File | Purpose |
|---|---|
| `evidence/` | One file per gate, using the template in `evidence/README.md` |
| `DEFECTS.md` | Triaged defects with severity and fix status |
| `DEFERRED.md` | Formally deferred items with owner sign-off |
| `UAT.md` | UAT checklist and results |
| `SIGNOFF.md` | Final release sign-off |

## Scope decisions

| Decision | Status | Evidence |
|---|---|---|
| Student attendance deferred; portal page hidden, API dormant | Decided 2026-10-31; re-affirmed/accepted 2026-11-18 (C5-02 in DEFERRED.md) | `evidence/C5-scope-decision.md` |
| Student contact fields authoritative for documents; `parent_student_links` is the only account linkage | Decided 2026-10-31; bulk-import columns implemented | `evidence/C3-parent-model-decision.md` |

## Current blockers

- C0 has not run: the working tree is dirty and the full verification suite has
  not been executed on a normal machine.
- C6 and C7 are unblocked by the C5 decision (attendance deferred), but still
  depend on C4.
