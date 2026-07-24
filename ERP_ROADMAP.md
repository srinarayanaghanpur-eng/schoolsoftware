# Sri Narayana High School — ERP Build Roadmap

> Living checklist for building the full school ERP + Parent Portal in phases.
> **Status legend:** ✅ done · 🟡 partial · ❌ not started · ⬜ planned task
> _AI add-ons are deferred — captured at the end, not in the active phases._

---

## Current state (audit summary)
- **Strong:** core Finance (ledger, expenses, vendors, dues, salary), basic fee collection, attendance + payroll (Stage 2–4), animated UI, RBAC sidebar, PWA.
- **Biggest gaps:** Promotion (0%), Admissions extras, full Parent Portal.
- Roughly **~65% built, ~10% partial, ~25% missing** of the non-AI scope.
- Phase 3 (Accounts statements) is now complete as of 2026-06-27.

---

## Phase 0 — Cross-cutting Foundations
*Build first — almost everything else writes to these.*

- ✅ **Audit log system** — every write records: who · what changed · old value · new value · date/time · branch · device/IP · reason · approval status
  - ✅ Generalized `writeAuditLog()` service in `lib/auditLog.ts` + Firestore `audit_logs` collection
  - ✅ Wired into concessions approval flow (`concessions/[id]/route.ts`)
- ✅ **Approval workflow engine** — generic request → approve/reject → log, reused by every module
  - ✅ Shared types + `lib/approvalEngine.ts` + `/api/admin/approvals` (GET/POST/PATCH)
  - ✅ `<ApprovalList />` component with filter tabs + approve/reject buttons
  - ✅ `/admin/approvals` page with "New Request" modal
  - ✅ Live pending count badge in sidebar (polls every 30s)
- ✅ **Branch / multi-school context** — branch field on records + scoping (needed for branch-wise & consolidated reports)
  - ✅ `BranchInfo` type + `lib/branchContext.ts` + `/api/admin/branches` GET/POST
  - ✅ `/admin/branches` page with full CRUD UI
  - ✅ `scopeQueryByBranch()` helper for filtered queries
- ✅ **Parent ↔ student linkage** + multiple-children grouping (foundation for Parent Portal)
  - ✅ `ParentStudentLink` type + `lib/parentStudentLink.ts` + `/api/admin/parent-student-links` GET/POST
  - ✅ `parentStudentLinkSchema` (Zod validation)

---

## Phase 1 — Admissions + Student Account
- ✅ New admission form (expanded — photo, documents, siblings, previous school, transport, emergency contact, gender, parent phones)
- ✅ Auto admission number
- ✅ Student photo upload (Firebase Storage)
- ✅ Aadhaar / documents upload
- ✅ Parent details (expanded — father/mother name + phone, email, emergency contact)
- ✅ Sibling / family group
- ✅ Previous school details
- ✅ Fee group selection (dynamic fee_structures DB used — fallback to hardcoded map when missing)
- ✅ Transport selection (link transport route/stop to student)
- ✅ Admission approval (Phase 0 engine — new admissions create a pending approval; approve activates the student)
- ✅ Admission receipt (acknowledgment + signature block on the printable admission form)
- ✅ Printable admission form (`/admin/admission-form/[id]`)
- ✅ Student profile QR code

---

## Phase 2 — Fees Collection & Accounts ✅
*Merges the earlier student-fee gap list.*

- ✅ Fee setup by class (Fee Structures)
- ✅ Fee heads — preset set: tuition, transport, books, exam, hostel, uniform
- ✅ Installments + due dates (plan, per-installment status, mark paid)
- ✅ Concession approval (wired into generic approval engine via `createApprovalRequest`)
- ✅ Fee collection screen (Payments)
- ✅ Payment modes — Cash / UPI / Bank / Cheque / Card full UI
- ✅ Auto receipt
- ✅ Receipt reprint (printable receipt page at `receipt/[paymentId]`)
- ✅ Cancel receipt with reason + approval (approval via `receipt_cancel` type)
- ✅ Due list
- ✅ Previous-year dues carry-forward (`feeBalanceCarriedForward` set on promotion, surfaced in student-wise report)
- ✅ Daily collection report (dedicated `collections` page + date filter)
- ✅ Monthly collection report (tab on fee-reports + API)
- ✅ User-wise collection report (`reports/user-wise` API + fee-reports tab, grouped by collector)
- ✅ Payment-mode-wise report (`reports/payment-mode` API + fee-reports tab, with share %)
- ✅ Per-student fee statement / history (`statements` page)
- ✅ Defaulters list (dedicated `defaulters` page + API)

---

## Phase 3 — Accounts + Finance (complete back office)
- ✅ Cash book — `/api/admin/finance/cash-book` + `/admin/finance/cash-book`
- ✅ Bank book — enhanced with date filter, running balance, CSV download
- ✅ Ledger
- ✅ Trial balance — `/api/admin/finance/trial-balance` + `/admin/finance/trial-balance`
- ✅ Profit & Loss — `/api/admin/finance/profit-loss` + `/admin/finance/profit-loss` (categorized breakdown)
- ✅ Daily account closing — formal close/reopen per day via `daily_closings` collection
- ✅ Expenses
- ✅ Vendor payments
- ✅ Salary payments
- ✅ Other income
- ✅ Deleted bills log — `/api/admin/finance/deleted-bills` + `/admin/finance/deleted-bills` (tracks rejected expenses, cancelled payments, audit deletions)
- ✅ Payables — consolidated vendor-wise in `/admin/finance/payables`
- ✅ Receivables — class-wise fee receivable in `/admin/finance/receivables`
- ✅ Branch-wise accounts — `/api/admin/finance/branch-accounts` + page
- ✅ Multi-school consolidated report — branch-accounts shows consolidated + per-branch

---

## Phase 4 — Promotion
*Entire module new.*

- ✅ Promote class-wise
- ✅ Promote selected students
- ✅ Detain / hold student
- ✅ Section change
- ✅ Academic-year change
- ✅ Old fee-balance carry-forward
- ✅ Promotion history
- ✅ Promotion approval (Phase 0 engine)

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
