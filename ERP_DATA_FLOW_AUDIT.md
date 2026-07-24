# ERP Data-Flow Audit — Sri Narayana Attendance / School ERP

**Date:** 2026-06-29
**Scope:** Full static audit of data entry → API → database flow across the web admin app, portal, teacher app, mobile app, Firebase backend, and exports.
**Status:** Audit only. No code changed.

---

## 0. How this audit was done (and its limits)

This is a **static code audit**. The codebase was read end-to-end (infrastructure, all API routes, representative pages per module, Firestore rules, exports). I could **not** run the app live this session: the Linux sandbox failed to start (out of disk), and a runtime CRUD test would in any case need real Firebase service-account credentials and a live Firestore project. So findings about *code wiring* are confirmed from source; findings labeled *runtime-dependent* need a live smoke test to close out.

The good news: this is **not** a "nothing is wired up" project. There are ~100 real API routes backed by the Firebase Admin SDK, real Firestore writes, a locked-down rules file, and working modules. The data-entry failures you describe trace to a **small number of systemic bugs**, not to missing backend.

---

## 1. Architecture (verified)

```
Browser page (client component)
        │  fetch  (must carry Firebase ID token in Authorization: Bearer …)
        ▼
/api/admin/* route (Next.js, server)
        │  requireAdmin / requirePermission  → verifyBearerToken(req)
        ▼
Firebase Admin SDK  (adminDb())  ── bypasses Firestore rules
        ▼
Firestore collections
```

- **Auth on every admin route** is enforced by `apiUtils.ts` (`requireAdmin`, `requirePermission`, `requireRole`) which reads the **`Authorization` header only** — there is **no cookie/session fallback** and **no `middleware.ts`**. If a request arrives without the bearer token, the route returns **401** and nothing is read or written.
- The intended, correct client helper is **`lib/adminApiClient.ts → adminApiRequest()`**, which fetches the current user's ID token and attaches it. Pages that use it work.
- `firebaseAdmin.ts` **throws** if no service-account env var is configured (`FIREBASE_SERVICE_ACCOUNT_KEY`, or client-email + private-key). With creds missing, **every** admin route 500s.

---

## 2. ROOT CAUSE #1 (Critical, explains most symptoms): pages call the API without the auth token

The single biggest issue: **inconsistent API-calling conventions**. Three patterns exist in the page layer:

| Pattern | Auth token attached? | Result |
|---|---|---|
| `adminApiRequest(...)` (shared wrapper) | ✅ yes | works |
| Local `apiRequest` helper that calls `auth.currentUser.getIdToken()` (e.g. attendance, salary pages) | ✅ yes | works |
| **Raw `fetch("/api/admin/...")` with no headers** | ❌ **no** | **401 → empty tables, failed saves** |

Because the route returns `{ success: false, error: "Unauthorized" }` with HTTP 401, the pages that check `if (data.success)` simply **never populate the table** and **silently fail to save** — which is exactly the reported behavior ("forms submit but records not saved," "tables stay empty," "dashboard counts don't change," "exports blank").

### Confirmed broken pages (raw `fetch`, zero token references in file, route requires a permission)

| Page | File | Route it calls | Guard on route |
|---|---|---|---|
| Students | `app/admin/students/page.tsx` | `/api/admin/students` (GET/POST/PATCH/DELETE) | `students.view` / `students.create` |
| Payments | `app/admin/payments/page.tsx` | `/api/admin/payments` | permission-guarded |
| Promotions | `app/admin/promotions/page.tsx` | `/api/admin/promotions` | `promotions.view` / `promotions.create` |
| Fee Reports | `app/admin/fee-reports/page.tsx` | `/api/admin/reports/*` | guarded |
| Fee Concessions (list) | `app/admin/fee-concessions/page.tsx` | `/api/admin/concessions` | `fees.view` |
| Fee Concessions (create) | `app/admin/fee-concessions/create/page.tsx` | `/api/admin/students`, `/api/admin/concessions` | `students.view`, `fees.create` |
| Admission form view | `app/admin/admission-form/[id]/page.tsx` | `/api/admin/*` | guarded (suspect — verify) |

> **Students is the canonical example:** `fetchStudents()` does `await fetch("/api/admin/students")` with no headers (line 206). The route requires `students.view` → 401 → table stays empty → POST/PATCH/DELETE all 401 → "Student added successfully" never fires because `data.success` is undefined. The student collection stays empty, so the dashboard (which counts `students` live) shows 0.

### Verified-OK pages (correctly authenticated)
- **37 pages** use `adminApiRequest` (most of `finance/*`, exams, branches, academic-years, approvals, notices, parents, library, inventory, hostel, transport, fee-structures, fee-reminders, messages, users, …).
- **Attendance** and **Salary** pages define their own local token-attaching `apiRequest` helper → OK.
- **Dashboard** is a server component reading Firestore via Admin SDK directly → OK (but shows 0s until the broken modules above start writing).
- **Mobile app** (`apps/mobile/lib/api.ts`) attaches `Authorization: Bearer <token>` correctly → OK.

**Pages that mix patterns (partially affected — verify each call site):** `users`, `finance/installments`, `finance/receipt/[paymentId]`, `calendar` (calendar does attach a token in 2 places, so likely OK).

### Fix
Replace every raw `fetch("/api/admin/...")` in the page layer with `adminApiRequest(...)` (or the local token helper). This is mechanical and low-risk. After the swap, re-test each module's full CRUD.

---

## 3. ROOT CAUSE #2 (High): split-brain collection names for fee structures

- API route `app/api/admin/fee-structures/route.ts` uses `const COLLECTION = "fee_structures"` (**snake_case**).
- `lib/feeService.ts` reads/writes **`feeStructures`** (**camelCase**) via the client SDK.
- `firestore.rules` defines **both** `fee_structures` (line 127) and `feeStructures` (line 191).

These are **two distinct collections**. Fee structures created through the admin UI land in `fee_structures`; any consumer going through `feeService` looks in `feeStructures` and finds nothing (and vice-versa). Pick one canonical name, migrate, and delete the other rule block. (Same camel/snake split risk exists conceptually between `concessions` and finance collections — those were checked and are internally consistent.)

---

## 4. ROOT CAUSE #3 (Critical, runtime-dependent): Admin credentials must be configured

`firebaseAdmin.ts` throws "Firebase Admin credentials are missing" if no service account is set. If the deployment is missing `FIREBASE_SERVICE_ACCOUNT_KEY` (or `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`), **every** admin route returns 500 and nothing persists — independent of Root Cause #1. Verify these env vars exist in the running environment (`apps/web/.env.local` / hosting secrets). This is the first thing to check at runtime because it would mask everything else.

---

## 5. Module status matrix

Status reflects **code wiring**, not a live runtime test. ✅ = correctly wired; ⚠️ = wired but has a caveat/needs runtime check; ❌ = confirmed broken in code.

| Module | Page data path | Status | Note |
|---|---|---|---|
| Dashboard | Server component, Admin SDK | ✅ | Shows 0s until upstream writes work |
| Students / Admissions | raw fetch, **no token** | ❌ | Root Cause #1 |
| Payments | raw fetch, **no token** | ❌ | Root Cause #1 |
| Promotions | raw fetch, **no token** | ❌ | Root Cause #1 |
| Fee Reports | raw fetch, **no token** | ❌ | Root Cause #1 |
| Fee Concessions (list + create) | raw fetch, **no token** | ❌ | #1; also dropdown can't load |
| Fee Structures | `adminApiRequest` | ⚠️ | Works, but collection-name split (#2) |
| Attendance | local token helper | ✅ | |
| Salary / Payroll | local token helper | ✅ | Has demo fallback when Firebase not configured |
| Teachers | `adminApiRequest` | ✅ | |
| Parents | `adminApiRequest` | ✅ | |
| Users / RBAC | `adminApiRequest` (+ some raw fetch) | ⚠️ | Verify the raw-fetch call sites |
| Exams / Results / Report cards | `adminApiRequest` | ✅ | |
| Notices / Messages / Notifications | `adminApiRequest` | ✅ | |
| Finance suite (invoices, ledger, expenses, incomes, vendors, cash-book, trial-balance, P&L, dues, defaulters, banking, branch-accounts, installments, receivables, payables, reminders, statements) | `adminApiRequest` | ✅ / ⚠️ | `installments` & `receipt` mix patterns — verify |
| Transport / Library / Hostel / Inventory | `adminApiRequest` | ✅ | |
| Holidays / Calendar | `adminApiRequest` / token | ✅ | |
| Academic Years / Branches / Approvals | `adminApiRequest` | ✅ | |
| Biometric ingest | `/api/biometric/log` (secret header) | ✅ | Real-device polling is a documented placeholder (`pollEsslDevicePlaceholder`) |
| Backup / Erase | `adminApiRequest` | ✅ | |
| Portal (parent/student) | portal API routes | ✅ | |
| Mobile app | token attached | ✅ | |

---

## 6. Authentication & security (Phase 7)

- Firestore `rules` are **well-built**: helper functions (`isAdmin`, `isActiveTeacher`, ownership checks), per-collection rules, and a **default-deny catch-all** (`match /{document=**} { allow read,write: if false }`). Good posture.
- Real enforcement happens in the **API layer** (Admin SDK bypasses rules), and routes are consistently guarded by `requireAdmin` / `requirePermission`. Verified on a representative sample.
- `resolveRole` falls back from token custom-claim to the `users/{uid}` Firestore doc — robust against stale claims.
- **Note:** the `students` collection has **no client rule**, so it correctly falls to default-deny; all student access must go through the API (it does). Fine by design.
- **No security holes found** in the rules. The auth bug in §2 is an availability bug (requests under-authenticated), not an over-permission bug.

---

## 7. Exports (Phases 8–9)

- `components/ExportButtons.tsx` builds XLSX client-side via `xlsx` (`json_to_sheet` → `writeFile`). The mechanism is correct.
- **Blank exports are a downstream symptom**, not an export bug: the buttons serialize whatever `attendance` / `salaryReports` / `biometricLogs` props the page holds. If the page failed to load data (Root Cause #1), the sheet is empty. Fixing data loading fixes exports.

---

## 8. Dead / placeholder code (Phase 10)

- `lib/demoMetrics.ts` — `demoDashboardSummary`, `attendanceTrend`, `salaryTrend` (hardcoded numbers). **Imported nowhere** → dead code. Safe to delete; not currently polluting any live screen.
- Salary page keeps a `demoReportsForMonth` fallback used only when `isFirebaseConfigured` is false. Acceptable as a dev fallback, but confirm `isFirebaseConfigured` is true in production so users never see demo salary numbers.
- `pollEsslDevicePlaceholder()` in the shared biometric service — intentional placeholder for device-specific SDK polling; webhook ingest path is real.
- Numerous `*_GUIDE.md` / `FEE_CONCESSION_*` docs at repo root — documentation, not code.

---

## 9. Prioritized fix plan (do NOT start until you approve)

### CRITICAL
1. **Confirm Firebase Admin credentials** are set in the running web environment (Root Cause #3). Without this, nothing else matters.
2. **Fix under-authenticated pages** (Root Cause #1): convert raw `fetch("/api/admin/...")` to `adminApiRequest` in: `students`, `payments`, `promotions`, `fee-reports`, `fee-concessions`, `fee-concessions/create`, and verify `admission-form/[id]`.

### HIGH
3. **Resolve the `fee_structures` vs `feeStructures` collection split** (Root Cause #2): choose one name, migrate data, update rules.
4. **Audit the mixed-pattern pages** (`users`, `finance/installments`, `finance/receipt/[paymentId]`) call-site by call-site for stray unauthenticated fetches.

### MEDIUM
5. Add a tiny **shared fetch guard** so this class of bug can't recur (e.g., lint rule or a single `apiClient` all pages must import; forbid raw `/api/admin` fetches).
6. Ensure `isFirebaseConfigured` is true in prod so the salary demo fallback never shows.

### LOW
7. Delete dead `lib/demoMetrics.ts`.
8. Tidy duplicate rule blocks once collection names are unified.

### Suggested fixing protocol (your Phase 12)
One module at a time, in this order: **Students → Payments → Fee Concessions → Fee Reports → Promotions → mixed-pattern finance pages.** After each: run the full Create / Read / Update / Delete loop, confirm the row appears, the dashboard count moves, and the export contains the row, before moving on.

---

## 10. Direct answers to your closing checklist

1. **Working modules ✅:** Dashboard, Attendance, Salary, Teachers, Parents, Exams/Results, Notices/Messages/Notifications, most of the Finance suite, Transport, Library, Hostel, Inventory, Holidays, Calendar, Academic Years, Branches, Approvals, Backup, Portal, Mobile app, Biometric webhook ingest.
2. **Partially working ⚠️:** Fee Structures (collection-name split), Users/RBAC, finance Installments & Receipt (mixed fetch patterns), Salary (demo fallback path).
3. **Broken ❌:** Students/Admissions, Payments, Promotions, Fee Reports, Fee Concessions (list + create), Admission-form view (verify) — all due to under-authenticated `fetch` calls.
4. **Missing backend APIs:** None found missing for the broken modules — the routes exist and are correct; the **frontend just isn't authenticating to them**.
5. **Missing database collections:** None missing, but **`fee_structures` vs `feeStructures` is a duplicate/mismatched pair** that must be unified.
6. **Missing Firebase integration:** None structurally; **runtime credential configuration must be confirmed** (Root Cause #3).
7. **Security issues:** None in the rules (default-deny, properly guarded). The auth bug is under-authentication (availability), not over-permission.
8. **Performance issues:** Minor — several routes fetch entire collections (`payments`, `students`) and sort/aggregate in memory; fine at school scale, revisit if data grows. Perf monitoring helpers already exist (`withPerformanceTracking`).
9. **Recommended fixes in execution order:** see §9.

---

*Prepared as a read-only audit. Awaiting your approval before any code changes; per your instruction, fixes will then proceed one module at a time with a full CRUD verification after each.*
