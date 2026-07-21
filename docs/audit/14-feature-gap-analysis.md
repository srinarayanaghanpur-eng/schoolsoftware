# 14 — Feature Gap Analysis (vs a working school ERP)

| Feature | Classification |
|---|---|
| Auth + RBAC (7 roles, server-enforced) | Fully implemented (claim-lag caveat) |
| Fee collection, receipts, idempotency | Fully implemented — untested at runtime |
| Fee structures, concessions | Implemented; duplicate legacy client code must be removed |
| Student/teacher/parent/user CRUD | Fully implemented |
| Staff attendance (GPS + biometric + admin edit) | Fully implemented |
| Leave management | Fully implemented |
| Payroll | Partially implemented (advance deduction + approval + payslip PDF missing) |
| Finance suite (expenses, ledger, P&L, banking, vouchers, bus finance) | Implemented but untested; per-request aggregation costs |
| Exams + marks + publish + parent view | Implemented (admin-only entry); grade calc/report-card templates partial |
| Report cards / hall tickets | Partially implemented |
| Homework | Partially implemented (no teacher authoring; submission writer unclear) |
| Timetable | Implemented (admin CRUD only; no teacher/parent view) |
| **Student attendance** | **Not implemented** (viewer exists over empty collection) |
| **Teacher academic workflow (classwork, tasks, principal approval)** | **Not implemented** |
| Classwork | Not implemented |
| Enquiry/admissions pipeline | Not implemented (direct admission only) |
| Year-end rollover with fee carry-forward | Not implemented / unverified |
| Bulk import (CSV students/fees) | Not implemented |
| Export | Partially implemented (client xlsx) |
| Fee reminders (WhatsApp/SMS) | Implemented but **inoperative** (no scheduler, no provider creds) |
| Notifications | Partially implemented (in-app only; no push) |
| Online payments (order/confirm) | Partially implemented (gateway verification unaudited) |
| Transport / inventory / library / hostel | Implemented but untested |
| AI agent (Gemini) | Implemented (runtime key required) |
| Audit logs | Backend exists, frontend viewer missing |
| Backup/erase/restore | Implemented — high-risk, needs super-admin verification |
| Receptionist role / student login | Not implemented (by design? confirm requirement) |
| Duplicate implementations | payment write ×3 (API tx / fees-confirm / dead client lib); academic-years UI ×2; reminders UI ×2; parent-link ×2 |
| Must be redesigned | dual fee-balance stores (students vs studentFeeSummaries) → single recalculation path |
