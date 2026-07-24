# 10 — Critical Real-World Workflow Traces

Columns: FE = frontend exists, BE = backend exists, DB = database exists, Conn = connected.

## A. New Student Admission
| Step | FE | BE | DB | Conn | Problem |
|---|---|---|---|---|---|
| Enquiry | ❌ | ❌ | ❌ | — | No enquiry module |
| Admission form | ✅ (`/admin/students`, admission-form) | ✅ | ✅ | ✅ | |
| Student ID generation | ✅ | ✅ (`counters` in students API) | ✅ | ✅ | |
| Parent record + link | ✅ | ✅ (parents API) | ✅ | ◐ | dual link mechanisms; auto-create-parent-on-admission to verify |
| Class assignment | ✅ | ✅ | ✅ | ✅ | |
| Fee structure assignment | ◐ | ◐ (`feeHeads` on student) | ✅ | ◐ | assignment step at admission needs verification |
| Concession | ✅ | ✅ | ✅ | ✅ | |
| Initial payment + receipt | ✅ | ✅ (payments tx) | ✅ | ✅ | |
| Parent portal access | ✅ | ✅ | ✅ | ✅ | account provisioning flow to verify |

**Verdict: PARTIAL — admission→fee→receipt works; enquiry missing, fee-assignment linkage unproven.**

## B. Daily STUDENT Attendance 🔴
| Step | FE | BE | DB | Conn |
|---|---|---|---|---|
| Teacher selects class | ❌ | ❌ | ❌ | — |
| Load student list (teacher) | ❌ | ❌ | — | — |
| Mark & submit | ❌ | ❌ | ❌ | — |
| Duplicate prevention | ❌ | ❌ | — | — |
| Parent view | ✅ | ✅ (`/api/portal/attendance`) | reads `student_attendance` | 🔴 collection never written |
| Reports | ❌ | ❌ | — | — |

**Verdict: NOT IMPLEMENTED. Only the parent-side viewer exists, pointed at an empty collection.**

## C. Staff Attendance & Payroll
| Step | FE | BE | DB | Conn | Problem |
|---|---|---|---|---|---|
| Check-in/out (GPS) | ✅ | ✅ `/api/attendance/mark` | `attendance` | ✅ | |
| Biometric ingest | ✅ | ✅ | ✅ | ◐ | device auth to verify |
| Late/leave/absence calc | — | ✅ (salary API reads attendance+holidays+leave) | ✅ | ✅ | |
| Payroll generation | ✅ `/admin/salary` | ✅ | `salary_reports` | ✅ | |
| Advance deduction | ◐ | ◐ | `salary_advances` | 🔴? | link between advances and salary calc not found — **verify/build** |
| Salary approval | ◐ | ◐ | — | ◐ | approval step unverified |
| Payslip | ✅ view (`/teacher/salary`) | ✅ | ✅ | ✅ | no PDF payslip found |

**Verdict: MOSTLY WORKS; advance-deduction and approval links are the gaps.**

## D. Fee Collection ✅
Search student → fee profile (heads, committed, paid) → enter payment → `validatePaymentAllowed` → transaction (payment+receipt+balance+summary+idempotency) → receipt page → dashboard dirty-flag → daily report API. Every step exists and is connected (`app/admin/payments/page.tsx` → `app/api/admin/payments/route.ts` → `lib/receiptService.ts`/`lib/feeRecalculation.ts`).
Missing: parent notification on payment (no push/SMS hook in payment tx; fee-reminder system is separate and scheduler-less).
**Verdict: COMPLETE at code level — the strongest workflow in the app.**

## E. Teacher Academic Activity 🔴
Every step (view tasks, submit teaching completion, homework/classwork creation, activity upload, principal approve/reject) — **no frontend, no backend, no collections**. The generic `approval_requests` engine could be reused but currently handles data-edit approvals.
**Verdict: NOT IMPLEMENTED.**

## F. Examination
| Step | FE | BE | DB | Conn |
|---|---|---|---|---|
| Create exam / subjects / classes | ✅ | ✅ | `exams` | ✅ |
| Timetable | ✅ (admin timetable; exam-specific TT ◐) | ✅ | ✅ | ✅ |
| Marks entry (admin) | ✅ | ✅ | `exam_marks` | ✅ |
| Max-marks validation | ◐ | ◐ | — | verify in marks route |
| Grades / report card | ◐ | ✅ report-card API | ✅ | ◐ |
| Publish → parent view | ✅ | ✅ publish flag + portal filter | ✅ | ✅ |

**Verdict: MOSTLY WORKS admin-side; teacher marks entry missing; grade calc to verify.**

## G. Academic Year Change
| Step | FE | BE | DB | Conn | Problem |
|---|---|---|---|---|---|
| Create new year | ✅ | ✅ | ✅ | ✅ | |
| Activate/close old | ✅ activate | ◐ | ✅ | ◐ | no explicit "close" semantics |
| Promote students | ✅ `/admin/promotions` | ✅ | `students`, `promotions` | ✅ | |
| Carry pending fees | ❓ | ❓ | — | 🔴? | no carry-forward logic located — **critical to verify before year rollover** |
| Preserve history / prevent mixing | ◐ | ◐ | year fields on docs | ◐ | year filter is optional query param on list APIs |

**Verdict: PARTIAL — promotion exists; fee carry-forward and year-scoping enforcement are the risks.**
