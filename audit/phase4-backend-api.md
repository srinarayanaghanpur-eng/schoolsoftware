# ERP Audit — Phase 4: Backend & API

**Scope:** Steps 9–10 — all 190 API route files + service layer (`lib/*Service`, feeRecalculation, receiptService, approvalEngine).
**Method:** guard/validation/transaction/audit-log coverage scans across every route; close reads of the money path (`fees/order`, `fees/confirm`, receiptService), attendance/mark, destructive endpoints, students CRUD.

---

## 1. Resolved from Phase 3

- **`create-teacher` mystery solved:** it's `export { POST } from "../teachers/route"` — a guarded re-export. ✅ Not a hole. (Same pattern: `biometric/ingest` → re-exports `biometric/log`.)
- **Destructive endpoints verified:** `erase-data` + `restore-data` = `requireSuperAdmin`; `reset-app` = super_admin + confirmation phrase; `students/bulk-delete` = `requirePermission("students.delete")` + transactions; `backup` = `requireAdmin` (⚠ = settings_manager can pull full backups — ties to AZ1).

## 2. The money path (deep read)

### 2.1 `POST /api/fees/confirm` — strengths

Textbook in several ways: full `runTransaction` covering order → payment → receipt → student totals → studentFeeSummaries → financeSummaries; **idempotent** (re-confirming a paid order returns the original payment, no duplicate); receipt numbers from a per-academic-year counter doc **inside the transaction** (no duplicate numbers under concurrency); overpayment and already-paid guards; denormalized summaries updated atomically with the source write.

### 2.2 The money path — findings

| # | Finding | Severity |
|---|---|---|
| B1 | **No payment verification and no ownership check on confirm.** `fees/confirm` requires only *any* authenticated token; the code comments admit "a real gateway would verify a signature here". Any signed-in user (a parent, a teacher) can confirm **any** payment order and mint a completed payment + official receipt without money changing hands. If UPI/online payment is live, this is the single worst issue in the codebase: fabricated paid receipts. Fix: verify gateway signature/webhook, and restrict confirm to the order's owner or finance roles. | **Critical** |
| B2 | `fees/order` similarly allows any authenticated user to create an order for **any studentId** (schema-validated but no link check). Combined with B1: full fake-payment pipeline. | **Critical** (same fix) |
| B3 | Post-transaction `recalculateStudentFeeSummary` is fire-and-forget with only console.error — a crash between