# Sri Narayana High School — ERP Build Roadmap

> Living checklist for building the full school ERP + Parent Portal in phases.
> **Status legend:** ✅ done · 🟡 partial · ❌ not started · ⬜ planned task
> _AI add-ons are deferred — captured at the end, not in the active phases._

---

## Current state (audit summary)
- **Strong:** core Finance (ledger, expenses, vendors, dues, salary), basic fee collection, attendance + payroll (Stage 2–4), animated UI, RBAC sidebar, PWA.
- **Biggest gaps:** Promotion (0%), Audit system (~5%), Admissions extras, installments, accounting statements (cash book / trial balance / P&L), most approval workflows, full Parent Portal.
- Roughly **~35–40% built, ~15% partial, ~45% missing** of the non-AI scope.

---

## Phase 0 — Cross-cutting Foundations
*Build first — almost everything else writes to these.*

- ⬜ **Audit log system** — every write records: who · what changed · old value · new value · date/time · branch · device/IP · reason · approval status
  - 🟡 Today: scattered ad-hoc logs (payroll access, backup, erase) — generalize into one service
- ⬜ **Approval workflow engine** — generic request → approve/reject → log, reused by every module
  - 🟡 Today: leave requests, password-reset, payroll/accountant access exist as one-offs
- ⬜ **Branch / multi-school context** — branch field on records + scoping (needed for branch-wise & consolidated reports)
- ⬜ **Parent ↔ student linkage** + multiple-children grouping (foundation for Parent Portal)

---

## Phase 1 — Admissions + Student Account
- 🟡 New admission form (expand current Add Student into a full admission flow)
- ✅ Auto admission number
- ⬜ Student photo upload (Firebase Storage)
- ⬜ Aadhaar / documents upload
- 🟡 Parent details (have father/mother/phone/email → expand)
- ⬜ Sibling / family group
- ⬜ Previous school details
- 🟡 Fee group selection (class-based fee exists → add fee-group entity)
- ⬜ Transport selection (link transport to student)
- ⬜ Admission approval (Phase 0 engine)
- ⬜ Admission receipt
- ⬜ Printable admission form
- ⬜ Student profile QR code

---

## Phase 2 — Fees Collection & Accounts
*Merges the earlier student-fee gap list.*

- ✅ Fee setup by class (Fee Structures)
- 🟡 Fee heads — make preset set: tuition, transport, books, exam, hostel, uniform
- ⬜ Installments + due dates
- 🟡 Concession approval (concessions exist → wire into approval engine)
- ✅ Fee collection screen (Payments)
- 🟡 Payment modes — add Cash / UPI / Bank / Cheque selection (today: UPI + simulated online)
- ✅ Auto receipt
- ⬜ Receipt reprint (wire existing `receipt/[paymentId]` API to UI)
- ⬜ Cancel receipt with reason (+ approval)
- ✅ Due list
- ⬜ Previous-year dues carry-forward
- 🟡 Daily collection report (`finance/daily` exists → UI)
- 🟡 Monthly collection report (summary/fee-reports exist → complete)
- ⬜ User-wise collection report
- ⬜ Payment-mode-wise report
- ⬜ Per-student fee statement / history
- ⬜ Defaulters list

---

## Phase 3 — Accounts + Finance (complete back office)
- ⬜ Cash book
- 🟡 Bank book (bank-accounts + transactions exist → format as book)
- ✅ Ledger
- ⬜ Trial balance
- ⬜ Profit & Loss
- 🟡 Daily account closing (`finance/daily` → formal closing)
- ✅ Expenses
- ✅ Vendor payments
- ✅ Salary payments
- ✅ Other income
- ⬜ Deleted bills log
- 🟡 Payables (purchases/pay → consolidate)
- 🟡 Receivables (dues → consolidate)
- ⬜ Branch-wise accounts
- ⬜ Multi-school consolidated report

---

## Phase 4 — Promotion
*Entire module new.*

- ⬜ Promote class-wise
- ⬜ Promote selected students
- ⬜ Detain / hold student
- ⬜ Section change
- ⬜ Academic-year change
- ⬜ Old fee-balance carry-forward
- ⬜ Promotion history
- ⬜ Promotion approval (Phase 0 engine)

---

## Phase 5 — Parent Portal
*Surfaces Phases 1–4 to parents. Today: only a stub `/portal` page + `portal/summary` API.*

### 5.1 Dashboard
- ⬜ Student profile · class & section · fee-due summary · latest exam results · announcements · upcoming events · important alerts

### 5.2 Fee Management
- ⬜ View total / paid / pending · previous-year balance · installment details
- ⬜ Online fee payment · UPI QR · payment history · download receipts · fee reminder notifications

### 5.3 Examination
- ⬜ Exam timetable · marks · grades · subject-wise performance · overall performance graph · teacher remarks · rank (optional) · report-card PDF

### 5.4 Notices & Circulars
- ⬜ School / branch / class / holiday / exam / event / fee / emergency notices (categorized + targeted)

### 5.5 Transport
- ⬜ Bus route · pickup/drop point · driver & vehicle details · transport fee
- ⬜ Live bus tracking *(optional — needs GPS device/driver app)*

### 5.6 Communication
- ⬜ Contact school · send enquiry · support ticket · complaint/suggestion · parent-meeting request · important contacts

### 5.7 Parent Profile
- ⬜ View parent details · update mobile request · update address request · change password · notification settings · multiple-children management

---

## Cross-cutting: Audit events to log (built progressively in each phase)
Admission created · Student edited · Fee collected · Receipt cancelled · Concession added · Expense added · Expense deleted · Student promoted · Student suspended · TC issued · Salary approved · User login/logout

## Cross-cutting: Approvals to implement (via Phase 0 engine)
Fee concession · Receipt cancellation · Expense · Salary · Student delete · TC issue · Promotion · Data edit

---

## Recommended build order (vertical slices)
1. **Phase 0** — foundations (audit + approvals + branch + parent linkage)
2. **Phase 1** — Admissions
3. **Phase 2** — Fees Collection & Accounts
4. **Phase 5.1–5.2** — Parent dashboard + fees  ← **MVP ends here (usable product)**
5. **Phase 3** — Accounts statements
6. **Phase 4** — Promotion
7. **Phase 5.3–5.7** — Exams, Notices, Transport, Communication, Parent Profile

---

## Deferred — AI add-ons (later, via Claude API over existing data)
Admissions: missing-field check · duplicate detection · fee-group suggestion · admission summary · parent welcome message.
Promotion: dues warning · weak-student review · promoted list · wrong class/section detection.
Fees: due-risk prediction · reminder message · daily-collection summary · suspicious-change / wrong-concession flags.
Finance: daily summary · expense anomaly · budget warning · cash-flow prediction · "where money went".

---

_Last updated: 2026-06-27_
