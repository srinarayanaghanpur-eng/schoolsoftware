# 12 — Data Consistency Audit

## Multi-document updates: what's safe, what's not

| Operation | Mechanism | Safe? |
|---|---|---|
| Payment recorded | `db.runTransaction` covering `payments`+`receipts`+`students`+`studentFeeSummaries`+idempotency (`/api/admin/payments`) | ✅ SAFE — model implementation |
| Receipt number | transactional `receipt_counters` per academic year (`lib/receiptService.ts`) | ✅ |
| Duplicate payment | idempotency key collection | ✅ |
| Overpayment | `validatePaymentAllowed` pre-check + inside-tx due calc | ✅ |
| Payment cancel / receipt cancel | `finance/receipt/[paymentId]/cancel` updates `payments` — **whether it reverses `students.totalFeesDue`, `studentFeeSummaries`, and `financeSummaries` is UNVERIFIED** | ⚠ VERIFY — if not, cancelled receipts silently corrupt balances |
| Concession change → totals recalc | concessions API writes `concessions`+`students`+`feeAuditLogs`; whether `studentFeeSummaries` is recalculated afterwards not confirmed | ⚠ VERIFY (`recalculateStudentFeeSummary` exists — confirm it's called) |
| Legacy client fee writes (`lib/feeService.ts`, `lib/paymentService.ts`, `lib/concessionService.ts`) | batch or direct client writes, no summary sync, missing school/year fields | 🔴 UNSAFE if ever invoked — currently unused; **delete in cleanup phase** |
| `financeSummaries` maintenance | incremented in payments POST & fees/confirm; rebuildable via `sync-summaries` / `rebuild-dashboard-summary` | ◐ dual-write pattern; drift possible → rebuild endpoints are the safety valve |
| Leave approval → attendance | `lib/leaveReview.ts` writes `attendance` + edit-audit + admin audit | ✅ |
| Attendance change → payroll | payroll recomputes from `attendance` at generation time (pull model) | ✅ by design; but regenerating an already-approved month? verify immutability |
| Salary advance approved → payroll deduction | link not found in code | 🔴 GAP |
| Teacher inactivated → timetable entries | no cascade found (timetable rows carry names) | ⚠ orphaned entries possible |
| Class/section merge | `class-sections/merge` updates `students` + `studentFeeSummaries` + `settings` | ✅ considered |
| Student delete (bulk) | deletes `students` + `studentFeeSummaries`; payments/receipts of the student remain (correct for audit) | ✅/◐ |
| Role change → permissions | Firestore `users.role` is checked per-request server-side (immediate), custom claims/rules lag up to ~1h (client-direct Firestore reads honor stale role) | ⚠ known, documented in `firestore.rules` comments |
| Academic year change → history | data carries `academicYearId` (API-created docs); enforcement optional; legacy docs may lack it | ⚠ |
| Year rollover → pending fee carry-forward | not implemented/not found | 🔴 GAP |

## The dual-balance problem (top data risk)

Fee state lives in **both** `students` (totalFeesDue/Paid/feeStatus) and `studentFeeSummaries` (dueAmount/totalPaid/…). The payment transaction updates both atomically ✅, but at least 6 other writers touch one or the other (students API, sync-summaries, class merge, feeRecalculation, fees/confirm, legacy client libs). Every fee-affecting code path must go through one recalculation function, or one of the two stores should be derived-only.

## Financial ops flagged unsafe until verified
1. Receipt cancellation reversal chain.
2. Concession edit/delete recalculation.
3. Salary advance ↔ payroll linkage.
4. Year-end fee carry-forward.
