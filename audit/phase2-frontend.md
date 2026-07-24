# ERP Audit — Phase 2: Frontend (Pages · Components · Routing)

**Scope:** Steps 4–6 — web pages (108), components (~68), routing; mobile (16 screens).
**Method:** full route/component enumeration, line-count metrics on every page, static pattern scans (client/server split, Firestore access, error handling, a11y), close reads of AuthGate, routeAccess, admin layout, students page, RBAC matrix.

---

## 1. Routing Audit

### 1.1 Route protection model

All protection is **client-side**: `AuthGate` (in each area layout) reads the central `lib/routeAccess.ts` table and redirects unauthenticated users to `/login`, wrong roles to `/unauthorized`. There is **no middleware.ts**, no server-side gate. `AuthGate` correctly renders a loader (not children) until the role check passes, so protected *content* doesn't flash — but all page JS bundles are publicly downloadable, and any page that fetched data server-side would leak (currently pages are 94/108 `"use client"`, so data comes post-auth via API — mitigating).

### 1.2 Route table (from `routeAccess.ts`)

| Route prefix | Allowed roles |
|---|---|
| `/admin` (catch-all) | super_admin, admin, principal, accountant, settings_manager |
| `/admin/finance`, `/admin/fee-reminders` | super_admin, admin, accountant |
| `/admin/settings` (+ academic-years) | super_admin, settings_manager |
| `/admin/ai-agent/settings` | super_admin, admin |
| `/admin/ai-agent`, `/admin/users`, `/admin/roles`, `/admin/report-cards` | back-office roles |
| `/teacher/*` | teacher |
| `/portal/*` | parent |
| everything else | **public/unguarded** |

Longest-prefix matching is correctly implemented. Design is clean and single-source-of-truth (used by both AuthGate and nav). Fine-grained module access additionally uses `hasPermission()` from the shared RBAC matrix (7 roles × 26 modules × 7 actions, wildcard for admin).

### 1.3 Routing findings

| # | Finding | Severity |
|---|---|---|
| R1 | **Public routes by omission**: `/receipts/[id]`, `/receipts/print/[id]`, `/vouchers/[id]`, `/vouchers/print/[id]`, `/student-qr` are unguarded. Receipts/vouchers expose financial data keyed only by document ID; `student-qr` has a "StudentDetailsReveal" component — data exposure depends entirely on backing API auth (verify Phase 3). | High |
| R2 | Role gating trusts the client-held role; a tampered client can render any page shell (data still gated by API/rules). Acceptable only if Phase 3/4 confirm every API enforces roles server-side. | Med |
| R3 | Students share `/portal` with parents but route table lists only `parent` → verify how student accounts log in (or whether they're unsupported — mismatch with RBAC's role list which has no `student`). | Med |
| R4 | No `not-found.tsx` — unknown routes fall to Next default 404. Minor. | Low |
| R5 | Dead/unclear: `/admin/portal` (29 lines), `/admin/page.tsx` (5 lines, likely redirect). Confirm intent. | Low |

## 2. Page Audit (108 pages)

### 2.1 Global patterns

- **94/108 pages are `"use client"`** — the app is effectively a client-rendered SPA inside Next.js. SEO irrelevant here, but it means: no streaming/RSC benefits, large client bundles, all data fetched in `useEffect` → visible loading spinners everywhere and the 4 GB build footprint.
- **Data access is API-first, not Firestore-direct**: `getDocs`/`onSnapshot` appear in only ~5 files (payments page, 3 settings components, authSession). Pages call `adminApiRequest` (with `AdminApiError` typed errors). Only **one** realtime listener path (`firestoreDebugLogger`). Excellent for Firestore cost + single authorization surface — better than Phase 1 assumed (downgrades concern A2).
- **Error handling**: 91/108 pages contain `try/catch`. But **zero `error.tsx` and zero `loading.tsx`** route files — no route-level error boundaries or suspense fallbacks; a render-time throw hits the single global `ErrorBoundary` (or white-screens if outside it). Loading is hand-rolled per page.
- **Accessibility: weak.** Only **8/108 pages** contain a single `aria-` attribute (23 total occurrences). Icon-button-heavy UI (lucide) with no labels will fail screen-reader and likely axe checks despite `@axe-core/playwright` being installed.
- **Pagination/limits**: `PaginationControls` + `STUDENTS_PAGE_SIZE = 25` — good practice at least in students page.

### 2.2 Oversized pages (God components — top refactor targets)

| Page | Lines | Notes |
|---|---|---|
| `admin/students` | **2,111** | CRUD + photo upload + docs + transport + QR + print + fee link in one file; ~15 responsibilities |
| `admin/admission-form/[id]` | 1,439 | Monolithic form |
| `admin/payments` | 879 | Also one of the few with direct Firestore reads — inconsistent with the API-first pattern |
| `admin/salary` | 847 | Payroll UI |
| `admin/dashboard` | 677 | Charts + stats (lazy-loaded charts exist — good) |
| `admin/promotions` | 657 | |
| `admin/notifications` | 604 | |
| `admin/finance/reminders` | 586 | |

Anything >400 lines (≈15 pages) should be decomposed into feature components + hooks. These files are the main source of re-render breadth (state at page top level → whole page re-renders on each keystroke in a form).

### 2.3 Per-module page inventory (purpose · size · flags)

**Auth/public:** `/` (landing), `/login` (+LoginClientLoader), `/forgot-password`, `/unauthorized`, `/student-qr` ⚠ public.
**Admin core:** dashboard(677), students(2111⚠), teachers(489), parents(258), users(494), attendance(509), my-attendance(105), approvals(184), branches(440), backup(5 → thin wrapper over BackupErasePanel), biometric(117), calendar(98), holidays(443), timetable(341), homework(207,+[id] 303), certificates(300), report-cards(147), settings(50), settings/academic-years(337), academic-years(8 → redirect/stub), notifications(604), notices(122)+circulars(125), messages(140), promotions(657), exams(178,+[id] 102,+hall-ticket 190), admission-form[id](1439⚠), portal(29 stub?), reports(324), fee-structures(344), fee-concessions(161,+create 285), fee-reports(6 stub), fee-reminders(324;+settings 350, logs 238, history 217, retry-queue 297), salary(847⚠), payments(879⚠), ai-agent(403;+settings 439, logs 246, quota 500).
**Admin finance (25):** hub(490), reminders(586⚠), collections(188), installments(219), statements(185), invoices(98), income(5 stub), expenses(148), vendors(94), payables(102), receivables(125), dues(103), defaulters(116), ledger(93), cash-book(106), banking(125), trial-balance(103), profit-loss(124), branch-accounts(105), deleted-bills(76), debit-vouchers(5 stub), receipt/[paymentId](16). Several 5–6-line stubs re-export a shared list component — consistent shell pattern (`FinanceShell`/`FinanceTabs`), good.
**Admin transport (11):** hub(59), drivers(175), fuel-logs(209), daily-km(171), maintenance(187), insurance(207), bus-finance(261,+[id] 408,+create 146,+reports 174).
**Other modules:** hostel(69), library(65), inventory(78) — thin; likely early-stage.
**Teacher:** page, dashboard, salary — small area; teacher/layout wraps AuthGate role="teacher".
**Portal (13):** hub(466), fees(229), payments(137,+[id] 20), attendance(166), homework(163), exams(201), notices(141), calendar(222), transport(157), downloads(140), profile(236), contact(147). Sizes healthy. Child selection via `PortalChildContext`.
**Print/public:** receipts ×2, vouchers ×2 ⚠ (R1).

## 3. Component Audit (~68 components)

- **Contexts (5):** AuthProvider (auth/status/role), AdminSessionContext (admin identity + permissions), AcademicYearContext, PortalChildContext, ThemeProvider. Clean layering; AuthGate consumes AuthProvider. No global state library — appropriate, context granularity avoids app-wide re-renders *if* values are memoized (verify AdminSessionContext value identity in Phase 7).
- **Layout system:** AppShell / OptimizedAppLayout / PageHeader / FinanceShell / FinanceSubnav / PortalSubnav — consistent shells per area; finance area is exemplary (stub pages + shared shell = low duplication).
- **Reusable primitives:** ResponsiveTable, PaginationControls, StatCard, StatusBadge, DatePicker, DateRangeFilter, FilterSheet, ActionMenu, ExportButtons, PasswordInput — a de facto design system, but no ui/ library (shadcn etc.); consistency depends on discipline.
- **Duplication flags:** StatusBadge vs finance/FinanceStatusBadge; StatCard vs finance/FinanceStatCard; Charts vs LazyDashboardCharts (ensure the non-lazy one isn't also imported eagerly); web vs mobile duplicated infra libs (Phase 1 A7).
- **Settings components own their Firestore access** (PaymentUpiSettings, CampusGpsSettings, AdmissionApprovalSettings use client SDK directly) — the only writes outside the API path; must be covered by firestore.rules (Phase 5 check).
- **ErrorBoundary exists but is only valuable where mounted** — with no route error.tsx files, coverage is app-root only.

## 4. Mobile App Audit (16 screens)

Screens: index(28), login(166), home(168), admin(78), parent(47), accountant(41), attendance(195), history(170), fees(27), payments(31), people(66), reports(32), messages(309), calendar(313), profile(99), _layout(13).

- Many screens are 27–47 lines — **stubs/placeholder tier**; the real app is login/home/attendance/history/messages/calendar. Mobile is early-stage relative to web.
- Flat expo-router routes with role screens (`admin`, `parent`, `accountant`) — no route groups/guards visible in `_layout` (13 lines); role gating presumably inside `mobileSession`. Verify a parent can't navigate to `/admin` screen (Phase 3).
- Uses `lib/api.ts` → web API + Firebase auth; consistent with web's API-first model.
- Duplicated perf/cache/sync libs from web (should move to `packages/shared`).

## 5. Scores & top actions

| Area | Score | Rationale |
|---|---|---|
| Routing design | 8/10 | Single-source route table, correct prefix logic; −: client-only enforcement, public-by-omission routes |
| Page quality | 6/10 | Consistent API-first pattern, good shells; −: 15 God pages, all-client rendering, hand-rolled loading |
| Component architecture | 7/10 | Good contexts/shells/primitives; minor duplication |
| Error/loading UX | 5/10 | try/catch widespread but zero route-level error/loading boundaries |
| Accessibility | **3/10** | 8/108 pages with any aria; icon buttons unlabeled |
| Mobile | 5/10 | Sound skeleton, many stub screens, code duplication |

**Top Phase-2 actions:** (1) add `middleware.ts` session check for `/admin|/teacher|/portal` (defense-in-depth); (2) split students/admission/payments/salary pages; (3) add `error.tsx`+`loading.tsx` at each area root; (4) a11y pass on shared primitives (labels on icon buttons, table semantics) — cheapest at the primitive level; (5) decide fate of stub pages (`fee-reports`, `admin/portal`, hostel/library/inventory) — ship or remove; (6) migrate payments page + settings components to API-first for a single write path.

**Next: Phase 3 — Authentication, Authorization & Security** (login/session/claims flows, per-role matrix verification, the R1 public endpoints, cron/destructive APIs, firestore.rules deep read).
