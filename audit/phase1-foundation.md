# ERP Audit — Phase 1: Foundation (Structure · Dependencies · Architecture)

**Project:** Sri Narayana High School ERP (monorepo, v1.0.0)
**Audit date:** 2026-07-21
**Scope of this phase:** Steps 1–3 of master audit — project structure, dependency audit, architecture.
**Evidence basis:** direct inspection of package.json files (root, web, mobile, shared), full file enumeration of `apps/web/app`, `apps/web/lib`, `apps/web/components`, `apps/mobile`, `packages/shared`, `firebase.json`, `firestore.rules`.

---

## 1. Project Structure

### 1.1 Monorepo layout (npm workspaces)

```
/erp
├── package.json              # root workspace: scripts, shared test deps
├── firebase.json             # Firestore/Storage rules + emulator config (auth 9099, firestore 8080, storage 9199, UI 4000)
├── firestore.rules           # security rules (claims-based RBAC, optimized to avoid get() reads)
├── firestore.indexes.json    # composite indexes
├── storage.rules             # Storage security rules
├── scripts/
│   └── check-admin-api-auth.js   # custom lint: verifies admin API routes enforce auth (its existence = known risk area)
├── tests/                    # Playwright E2E, Lighthouse CI, seed data, QA report generator, AI reviewer
├── apps/
│   ├── web/                  # Next.js 14 App Router — the main ERP (≈800 TS/TSX files)
│   ├── mobile/               # Expo 54 / React Native 0.81 / expo-router — teacher & parent companion app (~35 files)
│   └── desktop/              # Electron wrapper of web build (dist/dist:portable scripts)
└── packages/
    └── shared/               # @sri-narayana/shared — types, zod schemas, services shared by web+mobile
```

### 1.2 apps/web — main application

```
apps/web
├── app/                          # Next.js App Router: 108 pages + 186 API route files
│   ├── page.tsx                  # root/landing
│   ├── login/, forgot-password/, unauthorized/, student-qr/
│   ├── admin/                    # ~85 admin pages
│   │   ├── dashboard, students, teachers, parents, users, attendance, my-attendance
│   │   ├── finance/              # 25+ pages: ledger, cash-book, banking, invoices, income, expenses,
│   │   │                         #  payables, receivables, dues, defaulters, installments, statements,
│   │   │                         #  trial-balance, profit-loss, debit-vouchers, deleted-bills, branch-accounts…
│   │   ├── fee-structures, fee-concessions, fee-reports, fee-reminders/ (settings, logs, history, retry-queue)
│   │   ├── transport/            # vehicles, drivers, fuel-logs, daily-km, maintenance, insurance, bus-finance (EMI)
│   │   ├── exams, promotions, academic-years, calendar, holidays, salary, payments
│   │   ├── hostel, library, inventory, biometric, backup, branches, approvals
│   │   ├── notices, circulars, messages, notifications, admission-form/[id]
│   │   └── ai-agent/             # Gemini AI module: chat, logs, settings, quota
│   ├── teacher/                  # teacher dashboard, salary (own layout.tsx)
│   ├── portal/                   # parent/student portal: fees, payments, attendance, homework,
│   │                             #  exams, notices, calendar, transport, downloads, profile, contact
│   ├── receipts/, vouchers/      # public print/view pages by ID
│   └── api/                      # 186 route handlers (see §1.3)
├── components/                   # ~68 shared components
│   ├── AuthProvider, AuthGate, AdminSessionContext, AcademicYearContext, PortalChildContext
│   ├── AppShell, OptimizedAppLayout, PageHeader, FinanceSubnav, PortalSubnav
│   ├── finance/ (FinanceShell, FinanceTabs, ResponsiveFinanceTable, FloatingCalculator…)
│   ├── receipts/, vouchers/, ai/ (AIChatPanel, AIToolSidebar…)
│   └── auth/AutoLogoutProvider, ErrorBoundary, ThemeProvider/Script, DarkModeToggle
├── lib/                          # ~67 modules — business/services layer
│   ├── firebaseAdmin.ts, firestoreServer.ts, apiUtils.ts, adminApiClient.ts
│   ├── authClaims.ts, authSession.ts, authStorage.ts, routeAccess.ts, rbacAdmin.ts, schoolScope.ts
│   ├── feeService, paymentService, concessionService, feeRecalculation, receiptService,
│   │   debitVoucherService, busFinanceService, financeAggregation, financeUtils, approvalEngine
│   ├── reminder/ (messageBuilder, whatsappProvider, smsProvider)
│   ├── ai/ (geminiClient, aiPrompts, aiPermissions, aiLogger, encryption)
│   ├── quota/ (geminiQuotaGuard, firebaseQuotaGuard, rateLimiter, cacheManager, usageLogger)
│   ├── cache/indexedDBCache, backgroundSync, serviceWorkerUtils, useWebWorker, lazyLoad,
│   │   requestOptimization, firebaseQueryOptimization, performanceMonitor, firestoreReadLogger
│   └── auditLog, uploadService, reportService, parentStudentLink, classSections…
├── hooks/useAutoLogout.ts
├── types/ (fee.types, busFinance.types)
├── public/ (sw.js service worker, worker.js web worker, manifest.json — PWA)
├── next.config.js, tailwind.config.js, tsconfig.json
└── ⚠️ NO middleware.ts  → no server/edge-level route protection (see §3.4)
```

### 1.3 API surface (186 route handlers)

| Group | Routes | Purpose |
|---|---|---|
| `/api/admin/**` | ~130 | Full CRUD across every module (students, teachers, parents, users/roles, finance ×30, fees, exams, transport, hostel, library, inventory, homework, timetable, holidays, promotions, reports, sync, backup, **reset-app**, **restore-data**) — firebase-admin SDK |
| `/api/portal/**` | 16 | Parent portal read APIs (children, fees, payments, receipt, attendance, homework, exams, notices, calendar, transport, downloads, profile, summary) |
| `/api/ai/**`, `/api/quota/**` | 10 | Gemini chat, generate-notice/fee-message, summarize-dues, settings, logs; quota guard |
| `/api/cron/**` | 2 | create-reminder-queue, process-reminder-queue (fee reminders via WhatsApp/SMS) |
| `/api/teacher/**` | 2 | me, salary |
| `/api/fees/**` | 2 | order, confirm (payment flow) |
| Misc | ~8 | biometric ingest/log (device integration), attendance/mark, receipts, login-id/check, password-reset-requests, academic-years/public, reports/daily |

High-risk endpoints to prioritize in Phase 3/4: `admin/reset-app`, `admin/restore-data`, `admin/backup`, `admin/students/bulk-delete`, `biometric/ingest` (device-originated, likely token-authenticated), `cron/*` (must be protected against public invocation), `fees/confirm` (money).

### 1.4 apps/mobile (Expo)

```
app/: index, login, home, admin, parent, accountant, attendance, history, fees,
      payments, people, reports, messages, calendar, profile, _layout
lib/:  firebase.ts, api.ts (calls web API), mobileSession.tsx, authStorage,
       useTeacherAttendanceData, mobileCache, backgroundSync, perf utilities
components/: Screen, Card, StatusPill, AnimatedEntrance, OfflineStatusIndicator
```
Role-based screens (admin/parent/accountant) exist as flat routes — routing protection to be verified in Phase 2/3. Notably several lib files (backgroundSync, requestOptimization, performanceMonitor, lazyLoad, firebaseQueryOptimization) are **duplicated** from web instead of living in `packages/shared` — refactor opportunity.

### 1.5 packages/shared

Types & schemas (models, schemas, rbac, feeReminder), services (attendance, salary + test/verify files, holiday, reports, reportExport, biometricDevice), firebase client init, seed scripts, date/format utils, employeeAuth. This is the right place for the duplicated web/mobile libs above.

---

## 2. Dependency Audit

### 2.1 Root (`package.json`)

| Package | Verdict |
|---|---|
| `@expo/config-plugins`, `@expo/metro-runtime` | ⚠️ Misplaced — Expo deps belong in `apps/mobile`. Root also pins `@expo/config-plugins ^55` while mobile pins `~7.0.0` → **version conflict / duplicate installs**. |
| `firebase ^10.14.1` | Duplicated in web, mobile, shared. Hoisting should dedupe, but v10 is **behind current v11/12 line**; upgrade recommended (modular tree-shaking improvements, bug fixes). |
| `react ^18.3.1`, `react-dom` | ⚠️ Conflicts with mobile's `react 19.1.0`. Two React majors in one workspace tree is a classic source of "invalid hook call" breakage. |
| `react-markdown`, `remark-gfm` | Used by AI chat presumably — should live in `apps/web`, not root. |
| Dev: `@playwright/test`, `@lhci/cli`, `@axe-core/playwright`, `firebase-admin`, `tsx` | ✅ Appropriate at root for the test suite. |

### 2.2 apps/web

| Package | Assessment |
|---|---|
| `next ^14.2.35` | Core. One major behind (15). Fine for now; plan upgrade. |
| `firebase` + `firebase-admin` | Core client + server SDKs. ✅ |
| `@firebase/firestore ^4.7.3` | 🔴 **Redundant & dangerous** — pinning a sub-package alongside `firebase` risks two Firestore instances/type mismatches. Remove; let `firebase` own it. |
| `@swc/helpers`, `styled-jsx`, `prop-types`, `dom-helpers`, `eventemitter3`, `fast-equals` | ⚠️ All look like **transitive deps promoted to direct deps** (styled-jsx/@swc ship with Next; prop-types/dom-helpers/eventemitter3/fast-equals are recharts internals). Likely added to paper over hoisting errors. Should be removed after fixing the real resolution issue. |
| `xlsx ^0.18.5` | 🔴 **Known vulnerabilities** (prototype pollution GHSA-4r6h, ReDoS) and the npm package is effectively unmaintained (SheetJS moved distribution off npm). Heavy (~1 MB). Replace with `exceljs` or SheetJS CDN build. Also present in `shared`. |
| `recharts ^3.8.1` | Heavy but used (dashboards). Ensure it's only in lazy-loaded chunks (`LazyDashboardCharts` exists — good). |
| `zod ^3.23.8` | ✅ Validation. Confirm it's used on **every** API route (Phase 4). |
| `@google/genai ^2.10.0` | AI module. Server-side only — verify the key never reaches the client (Phase 3). |
| `qrcode`, `lucide-react`, `clsx`, `tailwindcss` | ✅ Normal. |
| Scripts: `NEXT_IGNORE_INCORRECT_LOCKFILE=1` on every dev/build | 🔴 **Smell** — lockfile is out of sync with node_modules and being force-ignored. Non-reproducible builds. Fix the lockfile, drop the flag. |
| `NODE_OPTIONS=--max-old-space-size=4096` for build | ⚠️ Build needs 4 GB — symptom of very large pages/components; revisit in Phase 7. |

### 2.3 apps/mobile

Expo 54 / RN 0.81.5 / React 19.1 — coherent set. Issues: `@expo/cli` as a runtime dependency (should be dev), `@expo/config-plugins ~7.0.0` conflicts with root `^55` (major mismatch), `@react-navigation/core+elements` pinned directly alongside expo-router (expo-router manages these — risk of duplicate navigation contexts), `use-latest-callback` / `use-sync-external-store` again look transitive-promoted.

### 2.4 packages/shared

`firebase`, `xlsx` (same CVE concern), `zod` — minimal and sensible otherwise.

### 2.5 Summary table

| Issue | Severity |
|---|---|
| `xlsx` vulnerable/unmaintained (web + shared) | **Critical** (security) |
| React 18 (root/web) vs React 19 (mobile) in one hoisted tree | **High** |
| `@firebase/firestore` pinned separately from `firebase` | **High** |
| Lockfile force-ignored on every build | **High** (reproducibility) |
| `@expo/config-plugins` root ^55 vs mobile ~7 | **Medium** |
| 6+ transitive deps promoted to direct deps in web | **Medium** (masks resolution bugs) |
| Expo/react-markdown deps at root instead of app level | **Low** |
| firebase v10 aging, next 14 one major behind | **Low** (plan upgrades) |

---

## 3. Architecture Audit

### 3.1 High-level diagram

```
┌────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                       │
│  Web (Next.js 14, PWA: sw.js + IndexedDB + web worker)         │
│  Mobile (Expo 54 → lib/api.ts → web API + Firebase client)     │
│  Desktop (Electron wrapper of web build)                       │
│  Biometric devices ──POST──► /api/biometric/ingest             │
└──────────────┬──────────────────────────┬──────────────────────┘
               │ direct client SDK        │ HTTPS (Bearer ID token)
               ▼                          ▼
┌──────────────────────────┐   ┌─────────────────────────────────┐
│  Firebase Auth           │   │  Next.js API routes (186)       │
│  custom claims:          │◄──┤  lib/apiUtils · authClaims ·    │
│  role/status/teacherId   │   │  rbacAdmin · schoolScope        │
└──────────────┬───────────┘   │  zod validation · auditLog      │
               │               │  Services: feeService, payment, │
               ▼               │  approvalEngine, reminder/*,    │
┌──────────────────────────┐   │  ai/* (Gemini), quota guards    │
│  Firestore               │◄──┤  via firebase-admin (bypasses   │
│  rules: claims-based     │   │  rules — server IS the gate)    │
│  RBAC, ~0-read role fns  │   └───────────────┬─────────────────┘
└──────────────┬───────────┘                   │
               │                               ▼
               │               ┌─────────────────────────────────┐
               │               │  External: Gemini API,          │
               ▼               │  WhatsApp/SMS providers,        │
┌──────────────────────────┐   │  UPI QR payments                │
│  Cloud Storage (rules)   │   └─────────────────────────────────┘
└──────────────────────────┘
Cron: /api/cron/create- & process-reminder-queue (fee reminders)
```

### 3.2 Key connections

1. **Dual data path**: pages both call admin APIs (`adminApiClient`) *and* read Firestore directly with the client SDK (realtime listeners). Security therefore depends on **both** API auth checks and firestore.rules being correct — two surfaces to keep in sync (a recurring audit theme for Phases 3–5).
2. **RBAC via custom claims**: `role`/`status`/`teacherId` embedded in the ID token; firestore.rules read claims first, falling back to `users/{uid}` doc for legacy accounts. Deliberate cost optimization; documented trade-off: **role revocation takes up to ~1h** (token cache) — flagged for Phase 3.
3. **Roles observed so far**: `super_admin`, `admin`, `accountant`, `teacher`, `parent` (rules + mobile screens); plus route-level RBAC in `routeAccess.ts`/`rbacAdmin.ts` (full matrix in Phase 3).
4. **Offline-first layer**: service worker + IndexedDB cache + backgroundSync on both web and mobile (duplicated code).
5. **AI subsystem**: Gemini client with its own permissions, encryption (API key at rest), logging, and a quota-guard/rate-limiter layer — unusually mature for an in-house app; verify server-only usage in Phase 3.
6. **Money flows**: fees → order/confirm → receipts (print pages public by ID — verify ID guessability in Phase 3), debit vouchers, payroll/salary service in shared, bus EMI finance.

### 3.3 Architecture strengths

Serverless monolith (appropriate scale), claims-based rules designed to minimize billed reads, shared package with zod schemas and typed models, service-layer separation in `lib/`, quota/rate-limit guards, audit logging module, real E2E+Lighthouse+a11y test infrastructure, an in-repo auth-check linter for admin APIs.

### 3.4 Architecture concerns (to be deep-dived in later phases)

| # | Concern | Phase |
|---|---|---|
| A1 | **No `middleware.ts`** — no server-side route gating; page protection appears purely client-side (`AuthGate`), API-level per-route. Admin page shells and any static data in them are served to anyone. | 3 |
| A2 | Dual data path (direct Firestore + API) doubles the authorization surface | 3, 5 |
| A3 | ~1h stale-claim window after role revocation/deactivation | 3 |
| A4 | Cron endpoints as public API routes — invocation auth must be verified | 3, 4 |
| A5 | `reset-app` / `restore-data` / `bulk-delete` destructive endpoints | 3, 4 |
| A6 | Public receipt/voucher pages keyed only by document ID | 3 |
| A7 | Web/mobile duplicated infra code instead of shared package | 8 |
| A8 | 4 GB build memory + 800 files in web → bundle/complexity review | 7 |
| A9 | Fee reminder queue built on cron API routes (no Cloud Functions/Tasks) — at-least-once/retry semantics need review | 4, 6 |

---

## 4. Phase 1 verdict

Well-organized monorepo with a serious feature footprint (≈108 pages, 186 APIs, 3 clients) and evidence of deliberate cost/performance engineering. The top foundation-level risks are: dependency hygiene (vulnerable `xlsx`, React major split, force-ignored lockfile, transitive-dep pinning) and the absence of edge middleware for route protection.

**Preliminary scores (foundation only; refined in Phase 9):**
Architecture 7.5/10 · Dependency health 5/10 · Structure/organization 8/10

**Next: Phase 2 — Frontend audit** (every page, component, and route; web in depth + mobile).
