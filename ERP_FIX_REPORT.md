# ERP Data-Flow Fix Report

**Date:** 2026-06-29
**Scope:** Implemented the auth/data-flow fixes from the audit. UI unchanged, no features removed, no mock data introduced.

> **Verification caveat (important):** the isolated Linux sandbox was unavailable this session (out of disk), so I could **not** run a live build, typecheck, or live CRUD test. Every result below is **static verification** (full code-path tracing + a project-wide scan confirming no unauthenticated `/api/admin` calls remain). Commands for you to run live are in the last section.

---

## Root cause recap

Browser pages called `/api/admin/*` with raw `fetch()` and no `Authorization` header. Those routes require a Firebase ID token (`requirePermission`/`requireAdmin`), so every such call returned **401** → empty tables, failed saves, blank exports, stalled dashboard counts. The fix: route all browser→admin-API calls through `adminApiRequest()` (which attaches the token), and align a few backend handlers that used a weaker auth check.

---

## Per-module results

### Students ✅ fixed
- **Files changed:** `apps/web/app/admin/students/page.tsx`, `apps/web/app/api/admin/students/[id]/route.ts`
- **Problem:** all 5 `/api/admin` calls (fee-structures, transport routes, list, create/update, delete) were unauthenticated → 401. Also PATCH/DELETE used `verifyBearerToken` + a **custom-claim-only** role check, so admins whose role lives in the `users/{uid}` Firestore doc got **403** on edit/delete.
- **Fix:** converted all 5 calls to `adminApiRequest`; switched PATCH→`requirePermission("students.edit")`, DELETE→`requirePermission("students.delete")`, and added a guard to the previously-unprotected `GET /students/[id]` (`students.view`). Loading/error/success/refresh logic preserved; errors now surface the real API message.
- **CRUD (static trace):** Create ✅ Read ✅ Update ✅ Delete ✅ Persistence ✅ (writes hit Firestore, list re-reads after each mutation).

### Payments ✅ fixed
- **Files changed:** `apps/web/app/admin/payments/page.tsx`
- **Problem:** `/api/admin/payments` (list) and `/api/admin/students` (payment-form dropdown) were unauthenticated → 401.
- **Fix:** both converted to `adminApiRequest`. Cancel/order/confirm flows were already authed. Route auth was already correct (`requirePermission`, no fix needed).
- **CRUD:** Create (via `/api/fees/confirm`) ✅ List ✅ Cancel/status ✅ Dropdown ✅. Reports read the `payments` collection server-side, so they now receive real data.

### Fee Concessions ✅ fixed
- **Files changed:** `apps/web/app/admin/fee-concessions/page.tsx`, `apps/web/app/admin/fee-concessions/create/page.tsx`, `apps/web/app/api/admin/concessions/[id]/route.ts`
- **Problem:** list fetch, student dropdown, and create POST were unauthenticated → 401. **Security hole:** `concessions/[id]` GET/PATCH/DELETE (read + approve/reject + delete) had **no auth guard at all**.
- **Fix:** pages converted to `adminApiRequest`; added `requirePermission` to `[id]` GET (`fees.view`), PATCH (`fees.edit`), DELETE (`fees.delete`).
- **CRUD:** Dropdown ✅ Create ✅ List ✅ Approve/Reject/Delete now authenticated ✅.

### Fee Reports ✅ fixed
- **Files changed:** `apps/web/app/admin/fee-reports/page.tsx`
- **Problem:** `fetch('/api/admin/reports/<type>')` unauthenticated → 401 → empty reports → blank CSV/PDF exports.
- **Fix:** converted to `adminApiRequest`. All 6 report routes use `requirePermission("reports.view")` (verified). Reports aggregate real `payments`/`students`/`concessions` server-side; exports build from the loaded data, so they’re no longer blank.
- **CRUD/Reports:** all 6 tabs ✅ (load real DB data once signed in as a role with `reports.view`).

### Promotions ✅ fixed
- **Files changed:** `apps/web/app/admin/promotions/page.tsx`
- **Problem:** `fetch('/api/admin/students?…')` (the only raw call) unauthenticated → 401 → empty student list → couldn’t promote.
- **Fix:** converted to `adminApiRequest`. History + promote calls already used `adminApiRequest`; routes use `requirePermission`.
- **CRUD:** List ✅ Promote (create) ✅ History ✅ Persistence ✅.

### Admission Form view ✅ fixed
- **Files changed:** `apps/web/app/admin/admission-form/[id]/page.tsx` (+ the `students/[id]` GET guard noted under Students)
- **Problem:** `fetch('/api/admin/students/[id]')` unauthenticated (and the route had no guard).
- **Fix:** converted to `adminApiRequest`; route now requires `students.view`. View loads real student data with the token.

### Fee Structures collection split ✅ fixed
- **Files changed:** `apps/web/lib/feeService.ts`, `firestore.rules` (+ new `scripts/migrate-fee-structures.ts`)
- **Problem:** API wrote `fee_structures` (snake) while `lib/feeService.ts` read/wrote `feeStructures` (camel); rules defined both → split-brain.
- **Fix:** unified on **`fee_structures`** (per your preference). `feeService.ts` now uses `fee_structures`; removed the duplicate `feeStructures` rules block. `feeService` is currently imported nowhere, so this is low-risk. Migration script provided (idempotent; optional `--delete-legacy`).

### Mixed-pattern sweep (Phase 9) ✅ done
- **users** and **finance/installments**: had unauthenticated `fetch('/api/admin/students')` → converted to `adminApiRequest`.
- **calendar** and **finance/receipt/[paymentId]**: already attach the token manually → left as-is (safe).
- **lib/lazyLoad.ts** (`loadDashboardStats`, runs on every admin page via the admin layout): unauthenticated fetch → 401 → fixed to attach the token.

---

## Guardrail added (Phase 10)
- **New:** `scripts/check-admin-api-auth.js` — scans `apps/web/{app,components,lib}` and fails if any browser-side `fetch("/api/admin…")` lacks an `Authorization` header nearby.
- **Wired:** `npm run check:admin-api-auth` (added to root `package.json`). Use it in CI / pre-commit.
- Static trace: passes on the current tree (all remaining raw fetches attach the token; `public/` service worker is intentionally excluded).

---

## Files changed (complete list)
1. `apps/web/app/admin/students/page.tsx`
2. `apps/web/app/api/admin/students/[id]/route.ts`
3. `apps/web/app/admin/payments/page.tsx`
4. `apps/web/app/admin/fee-concessions/page.tsx`
5. `apps/web/app/admin/fee-concessions/create/page.tsx`
6. `apps/web/app/api/admin/concessions/[id]/route.ts`
7. `apps/web/app/admin/fee-reports/page.tsx`
8. `apps/web/app/admin/promotions/page.tsx`
9. `apps/web/app/admin/admission-form/[id]/page.tsx`
10. `apps/web/app/admin/users/page.tsx`
11. `apps/web/app/admin/finance/installments/page.tsx`
12. `apps/web/lib/lazyLoad.ts`
13. `apps/web/lib/feeService.ts`
14. `firestore.rules`
15. `package.json`
16. `scripts/check-admin-api-auth.js` (new)
17. `scripts/migrate-fee-structures.ts` (new)

---

## What you need to do

### .env.local (BLOCKER if missing)
No `.env.local` exists in this folder. The admin API needs Firebase Admin creds in `apps/web/.env.local` (and in your hosting env). Set **either** `FIREBASE_SERVICE_ACCOUNT_KEY` (full JSON) **or** `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` + `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. Without these every admin route returns 500.

Also ensure the signed-in admin has the right role — either a custom claim (`role: "admin"`) **or** a `users/{uid}` doc with `role: "admin"`. The code now honors both consistently.

### Firebase rules
Deploy the updated `firestore.rules` (the duplicate `feeStructures` block was removed):
```
firebase deploy --only firestore:rules
```

### Migration (only if you used the legacy collection)
If any fee structures were written to the old `feeStructures` collection:
```
npx ts-node scripts/migrate-fee-structures.ts
# verify in fee_structures, then optionally:
npx ts-node scripts/migrate-fee-structures.ts --delete-legacy
```

### Commands to run locally (I could not run these — sandbox was down)
```
npm run check:admin-api-auth   # guard: expect "✓ No unauthenticated /api/admin fetch calls found."
npm run typecheck:web          # confirm types compile
npm run build:web              # confirm production build
npm run dev:web                # then CRUD-test each module below
```

### Manual CRUD checklist (per module)
Sign in as admin, then for **Students / Payments / Fee Concessions / Fee Reports / Promotions / Admission Form**: create a record → confirm it appears in the list → edit → delete → hard-refresh and confirm persistence → confirm the dashboard count / report / export reflects the change.

### Deployment (Vercel + Firebase)
1. Set the Firebase env vars in Vercel project settings (same names as `.env.local`).
2. `firebase deploy --only firestore:rules` (and `firestore:indexes` if changed).
3. Redeploy the web app on Vercel.

---

## Remaining items (not blockers for the fixed modules)
- **Live verification still required** — all results above are static; run the commands and CRUD checklist to confirm end-to-end.
- **`lib/lazyLoad.ts` `loadStudents`** reads the `students` collection via the **client** Firestore SDK, which `firestore.rules` denies (students has no client read rule). This prefetch silently fails and doesn’t break the real Students page (which uses the API). Consider routing it through the API later, or leave it as a no-op cache warmer.
- **`public/sw.js`** batch-sync calls (`/api/admin/attendance/batch`, `/api/admin/payments/batch`) were not modified — service workers handle auth via their own queued-token mechanism; review separately if offline sync is in use.
- Remaining modules from the original audit (finance suite, exams, library, etc.) were already using `adminApiRequest` and are not part of this fix batch.
