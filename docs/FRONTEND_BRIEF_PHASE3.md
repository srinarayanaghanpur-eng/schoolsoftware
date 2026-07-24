# Frontend Brief — Phase 3 (Fees online + Parent/Student Portal)

> For Codex. UI only — don't touch `apps/web/app/api/**`, `apps/web/lib/**`, `packages/shared/**`.
> All calls need `Authorization: Bearer <firebase idToken>`.
> **Note:** after pulling backend changes, **restart `npm run dev:web`** (the dev server caches the
> shared package — a stale cache makes new endpoints look broken).

## Shared types now available
```ts
FeeStructure, FeeHead, PaymentOrder, PaymentOrderStatus, PortalSummary
feeStructureCreateSchema, paymentOrderSchema, paymentConfirmSchema, userStudentsLinkSchema
```
Permissions: `fees.view/create/edit`, `portal.view`.

---

## Module A — Fee structure  (`/admin/fee-structures`)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/admin/fee-structures?academicYearId=&className=` | — | `{ ok, structures: FeeStructure[] }` |
| POST | `/api/admin/fee-structures` | `{ academicYearId, className, heads:[{name,amount}] }` | `{ ok, id, total }` |
| PATCH | `/api/admin/fee-structures/[id]` | partial | `{ ok }` (total recomputed if heads change) |
| DELETE | `/api/admin/fee-structures/[id]` | — | `{ ok }` |

**UI:** per class (and active academic year), an editable list of **fee heads** (Tuition, Books, …)
with amounts; the **total** is computed server-side. Validate with `feeStructureCreateSchema`.

## Module B — Online fee payment  (collection UI + portal "Pay now")
Two-step flow (provider-agnostic — gateway is stubbed, the records are real):
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/fees/order` | `{ studentId, amount, paymentType?, note? }` | `{ ok, orderId, providerOrderId, amount }` |
| POST | `/api/fees/confirm` | `{ orderId, transactionId?, method? }` | `{ ok, receiptId, amount }` |

`confirm` records the payment (into the same `payments` collection admins use) **and** bumps the
student's `totalFeesPaid`. **UI:** a "Pay" button → call `order` → (later a real gateway popup) →
call `confirm` → show a **receipt** (`receiptId`, amount). For now you can confirm immediately after
order to simulate success.

## Module C — Parent/Student Portal  (`/portal`)
The `portal` route already exists (Codex added it). Wire it to:
| Method | Path | Returns |
|---|---|---|
| GET | `/api/portal/summary?studentId=` | `{ ok, summary: PortalSummary, linkedStudentIds }` |

`PortalSummary` = `{ student, fees:{total,paid,due,status}, attendancePercentage, marks[], notices[] }`.
- Only works for users with role **`parent`/`student`** (or admin) that are **linked** to a student.
- If a parent has multiple children, `linkedStudentIds` lists them — pass `?studentId=` to switch.
- **Build:** a portal dashboard showing the child's **fees** (with a **Pay now** button → Module B),
  **published exam marks**, **attendance %**, and **notices**. Only *published* exam results appear.

## Module D — Link a user to student(s)  (admin)
| Method | Path | Body | Returns |
|---|---|---|---|
| PATCH | `/api/admin/users/[uid]/students` | `{ studentIds: string[] }` | `{ ok, uid, studentIds }` |

**UI:** on the Users & Roles screen, for a `parent`/`student` user, a "Link students" control
(search/select students). This is what makes the portal show data.

---

## Backend status for Phase 3 — ✅ ALL DONE & TESTED
- ✅ Fee structures CRUD · ✅ Online payment order+confirm (updates student fees)
- ✅ Portal summary (scoped to linked students, published marks only) · ✅ Admin link endpoint
- ✅ Firestore rules for `fee_structures`, `payment_orders` · ✅ typecheck + live API tests pass

Ping me when Phase 3 UI is wired → **Phase 4 (Transport, Library, Hostel, Inventory)**.
