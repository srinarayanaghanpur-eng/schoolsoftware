# Sri Narayana High School ERP — Full-Stack Audit Report

**Date:** 2026-07-20 · **Auditor:** Claude (architecture / security / performance review)
**Scope:** Monorepo at `G:\erp` — web (Next.js 14), mobile (Expo), desktop (Electron), shared package, Firebase rules/indexes.
**Method:** Direct inspection of rules, auth layer, RBAC, API guards (all 186 route files scanned for guard usage), representative pages/components/services. With ~6,000 source files, every file was enumerated but not every line read; every conclusion below cites the file it came from.

---

## 1. Executive Summary

This is a serious, well-structured school ERP with a genuinely good server-side RBAC layer — far better than typical Firebase apps. 177 of ~186 API route files call an auth guard (`requirePermission`/`requireAdmin`/etc. from `lib/apiUtils.ts`), writes to sensitive collections go through the Admin SDK, and there is real attention to Firestore read costs, idempotency, and audit logging.

However, it is **not production-ready for 50,000 users** today. There are **4 critical security holes** (unauthenticated cron endpoints that send SMS/WhatsApp, a payment-confirm flow any logged-in user can abuse to mark any student's fees as paid, over-broad `signedIn()` read rules exposing all students' marks/notices/fee structures to any parent, and a broken `isParentOfStudent` rule). Testing infrastructure is referenced everywhere in `package.json` but **the `tests/` and `scripts/` folders do not exist** — 15 test scripts and the `check:admin-api-auth` guard script are dead references. Several pages exceed 2,000 lines and the app-shell is 1,373 lines, which hurts maintainability and bundle size.

**Overall Production Readiness: 6/10.** Fixable to 8+ in a focused 2–4 week hardening pass; the architecture itself does not need to change.

---

## 2. Project Structure

```
G:\erp
├── package.json               # npm workspaces monorepo root; scripts (many broken — see §16)
├── firebase.json              # Firestore/Storage rules + emulator config
├── firestore.rules            # 363-line security rules (claims-first role resolution)
├── firestore.indexes.json     # Composite indexes (payments, attendance, …)
├── storage.rules              # teacher-profiles, attendance-selfies only
├── apps/
│   ├── web/                   # Next.js 14 App Router — the main product
│   │   ├── app/               # 108 pages: /admin/** (back office), /portal/** (parent),
│   │   │                      #   /teacher/**, /login, /receipts, /vouchers, /student-qr
│   │   ├── app/api/           # 186 route.ts API handlers (admin, portal, ai, cron, fees…)
│   │   ├── components/        # 48 shared components (AppShell, AuthGate, contexts…)
│   │   └── lib/               # 67 modules: firebaseAdmin, apiUtils (guards), rbacAdmin,
│   │                          #   routeAccess, feeRecalculation, receiptService, ai/*, quota/*
│   ├── mobile/                # Expo (teacher attendance: camera, GPS, background fetch)
│   └── desktop/               # Electron wrapper (dist/portable builds)
└── packages/shared/           # Types (models, rbac, schemas/zod), salaryService,
                               # attendanceService, biometricDeviceService, firebase client, seed
```

Why each exists: `app/` is route-per-folder UI; `app/api/` is the entire backend (no separate server — all business logic runs in Next.js route handlers using firebase-admin); `lib/` holds server guards + client services side by side (see §16 for the risk); `packages/shared` gives web/mobile one source of truth for types, zod schemas, and RBAC.

---

## 3. Dependency Audit

Root (`package.json`): `firebase`, `react`, `react-dom`, `react-markdown`, `remark-gfm`, plus **misplaced Expo deps** (`@expo/config-plugins`, `@expo/metro-runtime`) that belong in `apps/mobile`. Dev: Playwright, axe-core, Lighthouse CI, firebase-admin, tsx — **all test tooling is installed but has no test files to run** (no `tests/` dir exists).

Web (`apps/web/package.json`):

| Package | Verdict |
|---|---|
| next 14.2, react 18, firebase 10, firebase-admin 12, zod, tailwind | Core, appropriate; Next 14 is one major behind |
| `xlsx` 0.18.5 | **Risk**: SheetJS on npm is stale/has known CVE history (prototype pollution/ReDoS advisories); heavy (~1 MB). Prefer the vendor CDN build or `exceljs` |
| recharts 3, lucide-react, qrcode, clsx | Used, fine |
| `@google/genai` | Used by AI agent routes |
| `prop-types`, `dom-helpers`, `eventemitter3`, `styled-jsx`, `fast-equals`, `@swc/helpers` | Look like transitive deps promoted to direct — likely removable |
| `@firebase/firestore` pinned alongside `firebase` | Duplicate-copy risk; drop the sub-package pin |

Mobile pins react 19.1/RN 0.81 while web pins react 18.3 — fine across workspaces, but shared package must stay React-free (it is).

---

## 4. Architecture

```
Browser (Next.js client pages, "use client" everywhere)
   │  Firebase Auth (ID token, custom claims: role/status/teacherId)
   ├──► Firestore direct reads (client SDK) — reads gated by firestore.rules
   └──► fetch /api/** with Bearer token
            │ verifyBearerToken → resolveRole (users/{uid} doc, claim fallback)
            │ requirePermission / requireAdmin / requireRole  (lib/apiUtils.ts)
            ▼
        Route handler business logic (transactions, batch writes)
            ▼
        firebase-admin → Firestore (bypasses rules) + Storage
            ▼
        Denormalized summaries: studentFeeSummaries, financeSummaries
Mobile (Expo) ──► same Firestore + API (attendance self-marking, source:"mobile")
Biometric device ──► POST /api/biometric/log  (x-biometric-secret header)
Cron (external) ──► /api/cron/* (fee reminder queue → WhatsApp/SMS providers)
```

Sound hybrid design: cheap reads client-side under rules, all mutations server-side. Two structural weaknesses: (1) role resolution does a Firestore `users/{uid}` read **on every API request** (`resolveRole`) — no caching, so at 50k users this multiplies read volume and latency; (2) no queue/worker tier — crons run inside Next.js request handlers with `MAX_PER_RUN = 5`, which won't clear a 50k-student reminder queue.

---

## 5. Authentication (§Step 7)

- Login: Firebase Auth; employee-ID login mapped to internal emails (`employeeIdToInternalEmail`). `resolveAuthSessionUser` (lib/authSession.ts) refreshes claims, loads `users/{uid}`, rejects missing profile/role and non-`active` status. Good failure taxonomy (`AuthSessionError` codes).
- Token verify: `verifyBearerToken` → `adminAuth().verifyIdToken(token)`; no revocation check (`checkRevoked` not set) — a disabled user's token stays valid up to 1h. Documented consciously in firestore.rules comments; acceptable but should be listed as a known risk.
- Forgot password: `/api/password-reset-requests` POST is **unauthenticated by design** with dedup of open requests, but **no rate limiting** → login-ID enumeration and request-spam are possible.
- No session cookies / middleware — there is **no `middleware.ts`**; route protection is entirely client-side (`AuthGate` + `routeAccess.ts`) plus per-API guards. Server APIs are safe; page shells are not (data still protected, but private UI renders for anyone who bypasses JS gating).

## 6. Authorization (§Step 8)

Roles (`packages/shared/src/types/rbac.ts`): `super_admin, admin, principal, accountant, teacher, parent, settings_manager`. Permission strings `module.action`, `*` wildcard, editable role docs in `roles/{roleId}` (client read-only; writes API-only — correct). `SELF_LOCK_PERMISSIONS` guards against locking yourself out — a thoughtful touch.

Route matrix (`lib/routeAccess.ts`): longest-prefix wins; finance/fee-reminders restricted to super_admin/admin/accountant; settings to super_admin/settings_manager; portals per role. **Note:** the prompt's roles "Student", "Receptionist" do not exist — parents and students share `/portal` and there is no receptionist role.

Gaps found:
- `requireAdmin` includes `settings_manager` (apiUtils.ts:35) — so every route guarded by plain `requireAdmin` is open to settings managers, including some finance/data routes. Verify each `requireAdmin` call site really intends that.
- `resolveRole` prefers the **Firestore doc over the verified claim** — correct for freshness, but it makes the users-collection write rule (`allow write: if isAdmin()`) the real privilege boundary: any admin can escalate anyone (including to super_admin) by editing a user doc. Consider restricting role-field changes to super_admin.
- storage.rules `isAdmin()` checks only `role == "admin"` — **super_admin cannot pass**, and it trusts claims only (no doc fallback): inconsistent with the rest of the system.

## 7. Firestore Rules (§Step 11)

Strengths: default-deny catch-all; claims-first role resolution to save reads (documented trade-off); audit-log collections deny