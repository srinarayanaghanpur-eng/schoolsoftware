# Frontend Brief — Finance & Fee Collection (full module)

> For Codex. UI only. `Authorization: Bearer <idToken>` on all calls.
> **Restart `npm run dev:web`** after pulling backend changes (shared-package cache).
> Visible to roles with `fees.*` / `payroll.*` perms → **admin + accountant** (gate with `hasPermission`).

## Shared types
```ts
Expense, Income, SalaryAdvance, LedgerEntry, FinanceSummary, ClassDues, FeeStructure, PaymentOrder
expenseCreateSchema, expenseStatusUpdateSchema, incomeCreateSchema, salaryAdvanceCreateSchema,
feeStructureCreateSchema, paymentOrderSchema, paymentConfirmSchema
```

## API contracts (all live & tested)

### Fee collection (existing + Phase 3)
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/api/admin/payments` | list / record a fee payment |
| GET/POST | `/api/admin/fee-structures` (+ `/[id]`) | class-wise fee heads, auto-total |
| POST | `/api/fees/order` → `/api/fees/confirm` | online pay (order→confirm→receipt) |
| GET/POST | `/api/admin/concessions` (+ `/[id]`) | discounts/concessions |

### Accounting (NEW)
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET/POST | `/api/admin/finance/expenses` | `{category,amount,date,description,vendor?,paymentMethod}` | `{ ok, expenses }` / `{ ok, id }` |
| PATCH | `/api/admin/finance/expenses/[id]` | `{status:"approved"\|"rejected"}` (approve) **or** partial edit | `{ ok }` |
| DELETE | `/api/admin/finance/expenses/[id]` | — | `{ ok }` |
| GET/POST | `/api/admin/finance/incomes` | `{category,amount,date,description,source?,paymentMethod}` | `{ ok, incomes }` |
| GET/POST | `/api/admin/finance/advances` | `{teacherId,amount,date,reason?}` | `{ ok, advances }` |
| GET | `/api/admin/finance/summary?from=&to=` | — | `{ ok, summary: FinanceSummary }` (P&L) |
| GET | `/api/admin/finance/ledger?from=&to=` | — | `{ ok, entries:[...with balance], closingBalance }` |
| GET | `/api/admin/finance/dues` | — | `{ ok, classes: ClassDues[], grandTotalDue, studentsWithDues }` |
| GET | `/api/admin/finance/receipt/[paymentId]` | — | `{ ok, receipt }` (printable data) |

`FinanceSummary` = `{ from, to, income:{fees,other,total}, expense:{general,salary,advances,total}, net }`.
Expense `status`: `pending → approved/rejected` (only approved counts in P&L/ledger).

## Screens to build (a "Finance" section)
1. **Finance dashboard** — P&L cards from `/finance/summary` (income, expense, **net**), with a date-range picker;
   income/expense breakdown; a mini ledger.
2. **Fee collection** — collect a fee (existing `payments`), show **receipt** (`/finance/receipt/[id]`, print/PDF).
3. **Fee structures** — class-wise heads editor (auto-total).
4. **Dues** — class-wise outstanding table from `/finance/dues` (drill into students with dues).
5. **Expenses** — list + "Add expense" form + **approve/reject** actions (approve gated by `fees.approve`).
6. **Other income** — list + add.
7. **Salary advances** — per-teacher advances list + add (gated by `payroll.create`).
8. **Ledger** — chronological money-in/out table from `/finance/ledger` with running balance + date filter.

## Design
- Use existing `card`, `field`, `btn-primary`, `PageHeader`, `MetricCard`. Responsive. `BrandLoader` for loading.
- Currency: format as `₹` (Indian grouping). Red for expense/dues, green for income/net-positive.

## Backend status — ✅ ALL DONE & TESTED
Expenses(+approval), Income, Advances, P&L summary, Ledger(+balance), Class-wise dues, Receipt data,
Fee structures, Online pay. Firestore rules added (`expenses`,`incomes`,`salary_advances`).
Typecheck + live API tests pass.

---

## Part 2 — Payables, Banking, Invoices, Reminders (NEW, all live & tested)
Shared types: `Vendor, Purchase, PurchaseItem, BankAccount, BankTransaction, Invoice`.
Schemas: `vendorCreateSchema, purchaseCreateSchema, purchasePaySchema, bankAccountCreateSchema, bankTxnSchema, invoiceCreateSchema`.

| Method | Path | Body / Query | Returns |
|---|---|---|---|
| GET/POST | `/api/admin/finance/vendors` (+ `PATCH/DELETE /[id]`) | `{name,contact?,phone?,address?,gstin?}` | `{ ok, vendors }` |
| GET/POST | `/api/admin/finance/purchases` | `{vendorId,billNo?,date,items:[{name,qty,rate}],amount,category?}` | `{ ok, purchases }` (status: unpaid/partial/paid) |
| POST | `/api/admin/finance/purchases/[id]/pay` | `{amount,method?}` | pays bill (full/partial) + **logs an approved expense** → P&L/ledger |
| GET/POST | `/api/admin/finance/bank-accounts` | `{name,bankName?,accountNumber?,openingBalance}` | `{ ok, accounts }` (tracks `currentBalance`) |
| GET/POST | `/api/admin/finance/bank-accounts/[id]/transactions` | `{type:"deposit"\|"withdrawal"\|"transfer",amount,date,description?,toAccountId?}` | updates balance(s) |
| GET/POST | `/api/admin/finance/invoices?studentId=` | `{studentId,items:[{name,amount}],date?}` | `{ ok, id, invoiceNo, total }` — **auto INV-0001** |
| GET | `/api/admin/finance/reminders` | — | `{ ok, reminders:[{studentId,name,phone,due}], count }` (students with dues) |
| POST | `/api/admin/finance/reminders` | `{studentIds:[],channel}` | queues reminders (SMS/WhatsApp provider = future) |
| GET | `/api/admin/finance/daily?from=&to=` | — | `{ ok, days:[{date,income,expense,net}] }` (chart series) |

### Extra screens
9. **Vendors & Purchases (Payables)** — vendor directory; purchase bills with **Pay** (full/partial); outstanding payables.
10. **Banking** — bank accounts with balances; deposit/withdraw/transfer; per-account transaction history.
11. **Invoices** — generate a student invoice (line items, auto number); list; print/PDF.
12. **Fee reminders** — dues list with "Send reminder" (select students → SMS/WhatsApp queue).
13. **Daily summary chart** — income vs expense per day (use `/finance/daily`) on the Finance dashboard.

### Backend status — ✅ ALL DONE & TESTED
Vendors, Purchases(+pay→expense), Bank accounts+transactions(balance), Invoices(seq #), Reminders, Daily series.
Rules added (`vendors`,`purchases`,`bank_accounts`,`bank_transactions`,`invoices`,`fee_reminders`,`counters`). typecheck + live tests pass.
