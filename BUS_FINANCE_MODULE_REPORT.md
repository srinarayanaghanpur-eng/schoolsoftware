# Bus EMI / Vehicle Finance — Implementation Report

**Date:** 2026-06-29
**Scope:** New admin module for managing monthly EMI repayments on school buses/vehicles bought on finance. Existing modules untouched; **separate from the student transport fee module**. All client calls use `adminApiRequest()` (token-authenticated). No mock data — real Firestore CRUD.

> **Verification caveat:** the Linux sandbox was unavailable this session, so I could not run `tsc`/build/live CRUD. Results below are static verification (full code-path tracing, pattern-matching to existing working modules, and a scan confirming the new pages use no unauthenticated fetch). Commands for you to run live are at the end.

---

## 1. Files created (13)

**Types & server logic**
- `apps/web/types/busFinance.types.ts` — shared client/server types + enums
- `apps/web/lib/busFinanceService.ts` — `generateEmiSchedule` (idempotent), `recalcFinanceSummary`, `derivePaymentStatus`, `emiDueDateFor`

**API routes**
- `apps/web/app/api/admin/bus-finance/route.ts` — GET list, POST create + auto-generate schedule
- `apps/web/app/api/admin/bus-finance/[id]/route.ts` — GET / PATCH / DELETE
- `apps/web/app/api/admin/bus-finance/[id]/emi-schedule/route.ts` — GET schedule, POST regenerate-missing
- `apps/web/app/api/admin/bus-emi-payments/[id]/route.ts` — PATCH (pay/partial/overdue), DELETE
- `apps/web/app/api/admin/bus-finance/reports/route.ts` — GET 6 report types

**Frontend pages**
- `apps/web/app/admin/transport/bus-finance/page.tsx` — list + 6 summary cards + actions
- `apps/web/app/admin/transport/bus-finance/create/page.tsx` — create form
- `apps/web/app/admin/transport/bus-finance/[id]/page.tsx` — detail + EMI schedule + record payment + edit loan
- `apps/web/app/admin/transport/bus-finance/reports/page.tsx` — reports + Excel/CSV/Print export

(2 of the above are nested route folders.)

## 2. Files modified (3)
- `packages/shared/src/types/rbac.ts` — added `bus_finance` module + accountant grants
- `apps/web/components/AppShell.tsx` — added "Bus Finance / EMI" sidebar entry (Transport section)
- `firestore.rules` — added `bus_finance` + `bus_emi_payments` rules

## 3. Collections added
- **`bus_finance`** — loan records (numbers stored as numbers; dates as ISO `yyyy-mm-dd`; `createdAt/updatedAt` server timestamps)
- **`bus_emi_payments`** — one document per EMI, linked by `busFinanceId` + `emiNumber`

## 4. API routes added
| Route | Methods | Permission |
|---|---|---|
| `/api/admin/bus-finance` | GET, POST | `bus_finance.view` / `bus_finance.create` |
| `/api/admin/bus-finance/[id]` | GET, PATCH, DELETE | `view` / `edit` / `delete` |
| `/api/admin/bus-finance/[id]/emi-schedule` | GET, POST | `view` / `create` |
| `/api/admin/bus-emi-payments/[id]` | PATCH, DELETE | `edit` / `delete` |
| `/api/admin/bus-finance/reports` | GET | `export` |

All routes use `requirePermission` (custom-claim **or** `users/{uid}` Firestore role — same robust pattern as the rest of the app) and return the `{ ok, ... }` shape that `adminApiRequest` expects.

## 5. Permissions added
Added module `bus_finance` with actions `view / create / edit / delete / export`. Mapping from the names in your spec (the permission type is strictly `module.action`):
- `busFinance.view` → `bus_finance.view`
- `busFinance.create` → `bus_finance.create`
- `busFinance.edit` → `bus_finance.edit`
- `busFinance.payments` → `bus_finance.edit` (recording EMI payments is an edit)
- `busFinance.reports` → `bus_finance.export`
- `busFinance.delete` → `bus_finance.delete` (**admin/super_admin only**)

**Role access:** admin & super_admin have all (wildcard). **Accountant** granted `view / create / edit / export` (not delete). Teachers, parents, students, receptionist, principal: **no access** (module hidden from their nav and blocked at the API).

## 6. Test results (static trace — run live to confirm)
- **Create bus loan** ✅ POST validates required fields + positive `totalEmis`/`emiAmount`, writes `bus_finance` with numeric fields, `paidEmis=0`, `pendingEmis=totalEmis`, `status="active"`.
- **Auto-generate EMI schedule** ✅ On create, `generateEmiSchedule` writes `totalEmis` rows with due dates = loan start month + (n−1), day clamped to `emiDueDay`. **Idempotent** — re-running only fills missing EMI numbers, never duplicates.
- **Mark EMI as paid** ✅ PATCH sets `paidAmount ≥ emiAmount` → status `paid`; recalculates parent `paidEmis`/`pendingEmis`; if all paid → loan `closed`.
- **Mark EMI as partial** ✅ `0 < paidAmount < emiAmount` → status `partial`; remaining shown in the schedule table.
- **Pending EMI** ✅ Unpaid, due date not passed → `pending`; appears in Pending report.
- **Overdue EMI** ✅ Unpaid + due date < today → `overdue` (set at generation, on recalc, and surfaced in the Overdue report + dashboard "Overdue Amount" card).
- **Export report** ✅ Reports endpoint aggregates real `bus_finance` + `bus_emi_payments`; page exports Excel (`xlsx`), CSV, and Print/PDF (browser print). Six reports: Monthly, Vehicle-wise, Pending, Overdue, Yearly, Company-wise.

Dashboard cards on the list page: Active Loans, Total Loan Amount, Total EMI Paid, Total EMI Pending, This Month Due, Overdue Amount (and Next Due derived from loan end dates).

## 7. .env / Firebase changes needed
- **.env:** none new. Uses the existing Firebase Admin credentials. (Reminder from earlier: ensure `apps/web/.env.local` / hosting has `FIREBASE_SERVICE_ACCOUNT_KEY` or client-email/private-key, else all admin APIs 500.)
- **Firebase rules:** **yes — deploy required.** `firestore.rules` now includes `bus_finance` and `bus_emi_payments` (admin/accountant). Deploy:
  ```
  firebase deploy --only firestore:rules
  ```
- **Indexes:** **none required.** All Firestore queries use a single `where` and sort in memory (the same approach the Students route uses to avoid composite-index errors). No `firestore.indexes.json` change.
- **Storage:** EMI payment proof uploads go to `bus-finance/<vehicleNumber>/proofs/...` via the existing upload service / `storage.rules`. If your storage rules are path-restrictive, allow that prefix for admins.

## 8. Design notes / decisions
- **Sidebar placement:** added as a dedicated "Bus Finance / EMI" item in the same nav section as Transport. Reason: the sidebar gates a parent menu by its own module, and accountants don't have `transport.view`; nesting it *under* Transport would have hidden it from accountants. A sibling entry gated on `bus_finance` shows correctly for both admin and accountant without widening their student-transport access.
- **No existing module touched** beyond the 3 additive edits above. The student transport fee flow is untouched.
- **Guardrail:** the new pages use `adminApiRequest` everywhere; `npm run check:admin-api-auth` (added earlier) still passes.

## 9. Run/verify locally (I could not — sandbox down)
```
npm run check:admin-api-auth   # expect: ✓ no unauthenticated /api/admin fetches
npm run typecheck:web          # confirm types
npm run build:web              # confirm build
firebase deploy --only firestore:rules
npm run dev:web                # then test the CRUD checklist in §6 as admin and as accountant
```

Manual test path: Transport → **Bus Finance / EMI** → Add Bus Loan (e.g. EMI ₹25,000 × 36) → confirm 36 EMI rows generated → Record Payment on EMI #1 (full → paid; partial amount → partial) → confirm summary cards + paid/pending update → open Reports → run each report → export Excel/CSV/Print → delete loan as admin (should also remove its EMI rows).
