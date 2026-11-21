# Defect Register

Triaged defects for the core readiness effort. Severity is assigned at triage by
the gate accountable role. "Open" means not verified fixed on the release commit.

## Severity definitions

| Severity | Definition | Release rule |
|---|---|---|
| P0 Blocker | Money wrong, data loss/corruption, security breach, or a core workflow impossible | Zero open. No release |
| P1 Critical | Core workflow broken with a workaround; reports materially wrong; limited authz gap; unusable performance | Zero open. Fix or formally defer with Product Owner sign-off |
| P2 Major | Non-core feature broken, or core workflow degraded with a workaround | Not blocking; tracked with target milestone |
| P3 Minor | Cosmetic or copy issue with no functional impact | Backlog |
| P4 Trivial | Nit | Backlog |

## Register

| ID | Title | Severity | Gate | Status | Owner | Found in commit | Fixed in commit | Notes |
|---|---|---|---|---|---|---|---|---|
| C1-01 | Principal and accountant can read the settings doc holding the biometric secret | P2 | C1 | Open | Security Lead | working tree | — | `firestore.rules:169-172`; tighten to admin/settings_manager or split secret fields into a server-only doc |
| C1-02 | Accountant can read fee-reminder provider API keys | P2 | C1 | Open | Security Lead | working tree | — | `firestore.rules:244`; move keys to env or a server-only doc |
| C1-03 | Dead client financial service stubs remain | P3 | C1 | Open | Backend Lead | working tree | — | `lib/paymentService.ts`, `lib/feeService.ts`, `lib/concessionService.ts`; zero importers, delete when convenient |
| C1-04 | Student profile and certificate print pages exposed PII without server-side auth | P0 | C1 | Fixed | Security Lead | working tree | working tree | `AuthGate` is client-only and middleware only does mobile-UA routing, so a direct GET rendered student Aadhaar/phones/address/fees via the Admin SDK. Replaced with authenticated `GET /api/admin/students/[id]/profile` and `GET /api/admin/certificates/[id]/print`; pages now fetch with a bearer token and render client-side. |
| C4-01 | Student profile fee summary mixed payments across academic years | P1 | C4 | Fixed | Backend Lead | working tree | working tree | Profile API keeps the lifetime payable fee aligned with lifetime completed payments for the summary, while the payment list is scoped to the student's academic year (id, legacy label, or active year). |
| C3-04 | Student profile documents tab could re-render infinitely | P2 | C3 | Fixed | Engineering | working tree | working tree | Effect depended on a fresh `documentURLs \|\| []` array each render; memoized the list and refresh from the server after upload/delete. |
| C3-05 | Student profile exam marks ignored section and academic year | P2 | C3 | Fixed | Engineering | working tree | working tree | Profile API now filters exams by class/classId, section, and academic year before returning marks. |
| C3-06 | Student profile read exam marks from a non-existent subcollection | P1 | C3 | Fixed | Backend Lead | working tree | working tree | Marks live in the top-level `exam_marks` collection; the profile API now queries by `studentId`, joins `exams`, and filters by class/section/year. |
| C3-07 | Certificate print Cancel consumed the one-time bonafide link | P2 | C3 | Fixed | Engineering | working tree | working tree | Cancel now only closes the viewer; consumption happens on print and is broadcast to the certificates tab for refresh. |
| C5-01 | Parent portal attendance page read an unwritten collection | P1 | C5 | Fixed | Engineering | working tree | working tree | Resolved by deferral: nav removed, page shows notice, API dormant |

Status values: Open, In progress, Fixed, Verified, Deferred, Wontfix.
