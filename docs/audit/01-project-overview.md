# 01 — Project Overview

Audit date: 2026-07-20. All statements below are verified against source code.

## Architecture Summary

Monorepo (npm workspaces): `apps/web` (Next.js 14 App Router, `next@^14.2.35`, React 18, Tailwind 3, TypeScript 5.5), `apps/mobile` (Expo/React Native), `apps/desktop` (Electron wrapper), `packages/shared` (shared types, role definitions, Firebase client init).

- **Frontend**: Next.js App Router client pages under `apps/web/app/**`. No server components doing data fetching of significance; pages are `"use client"` and call REST API routes with a bearer token via `lib/adminApiClient.ts` (`adminApiRequest`).
- **Backend**: Next.js API route handlers under `apps/web/app/api/**` (186 `route.ts` files) using **firebase-admin** (`lib/firebaseAdmin.ts`, `adminDb()`). There are **no Cloud Functions** and no separate server; cron-style endpoints exist at `app/api/cron/*` (fee reminder queue) intended for an external scheduler.
- **Database**: Firestore (single project, `teacher-nara` in emulator config). ~70 collections referenced (full map in `06-firestore-map.md`).
- **Auth**: Firebase Auth. Server verifies bearer tokens (`verifyBearerToken` in `lib/firebaseAdmin.ts`). Role resolution: Firestore `users/{uid}.role` preferred, custom-claim fallback (`resolveRole` in `lib/apiUtils.ts`).
- **RBAC**: Roles: `super_admin`, `admin`, `principal`, `accountant`, `settings_manager`, `teacher`, `parent`. Permission model in `packages/shared` + `lib/rbacAdmin.ts` (`roleHasPermission`, permission strings like `fees.view`, `fees.create`). Route-level UI gating in `lib/routeAccess.ts` (`routePermissions`, longest-prefix match) enforced by `components/AuthGate.tsx` / `components/AppShell.tsx`.
- **Firestore security rules**: `firestore.rules` at repo root — real, role-aware rules using custom claims (`effectiveRole()`), with documented cost trade-off (claims may lag role changes by up to ~1h).
- **State management**: Local React state + context providers (`components/AuthProvider.tsx`, `AdminSessionContext.tsx`, `AcademicYearContext.tsx`, `PortalChildContext.tsx`, `ThemeProvider.tsx`). No Redux/Zustand.
- **Storage/uploads**: `lib/uploadService.ts` (not deeply audited).
- **Offline/perf machinery**: `lib/backgroundSync.ts`, `lib/cache/indexedDBCache.ts`, `public/worker.js`, `lib/firestoreReadLogger.ts` (read-quota logging), `lib/requestOptimization.ts`.
- **AI subsystem**: Gemini integration (`lib/ai/*`, `lib/quota/*`, `/api/ai/*`, `/admin/ai-agent/*`) with quota guards, encryption of settings, usage logging.
- **Testing**: Playwright e2e (`tests/`, emulator-based: `test:e2e` scripts in root `package.json`), Lighthouse CI, seed scripts (`tests/seed/seed-test-data.ts`). Presence verified via package.json; test coverage not executed in this audit.
- **Deployment config**: `firebase.json` at root (emulators at minimum); web build via `next build`; desktop via electron-builder (`dist:desktop`). No CI files inspected yet.
- **Auth-guard tooling**: root script `scripts/check-admin-api-auth.js` (`check:admin-api-auth`) — the project self-checks that admin APIs call auth helpers.

## Entry Points

| Concern | File |
|---|---|
| Web app root | `apps/web/app/layout.tsx`, `apps/web/app/page.tsx` |
| Login | `apps/web/app/login/page.tsx` → `LoginClient.tsx` |
| Auth provider | `apps/web/components/AuthProvider.tsx`, `components/AuthGate.tsx` |
| Route access | `apps/web/lib/routeAccess.ts` |
| API auth helpers | `apps/web/lib/apiUtils.ts` (requireAdmin/requirePermission/…) |
| Firebase Admin | `apps/web/lib/firebaseAdmin.ts` |
| Firebase client | `packages/shared/firebase/client` |
| RBAC | `apps/web/lib/rbacAdmin.ts` + `packages/shared` role types |
| Firestore rules | `firestore.rules` (repo root) |

## Key Observations (verified)

1. **Two backend styles coexist**: most features go through admin-SDK API routes (good), but several `lib/*Service.ts` files write to Firestore **directly from the client SDK** (`lib/paymentService.ts`, `lib/feeService.ts`, `lib/concessionService.ts`). `lib/paymentService.ts` is imported by **no page** (verified by grep) — it is dead/duplicate legacy code that duplicates `/api/admin/payments` with a weaker (non-transactional receipt-number, no idempotency, no school/year scoping) implementation.
2. **No student attendance subsystem** — the single biggest functional gap. Collection `student_attendance` is read by `app/api/portal/attendance/route.ts` (parent portal) but **no code anywhere writes it** (verified by repo-wide grep). The `attendance` collection is exclusively **staff/teacher** attendance (GPS check-in via `/api/attendance/mark`, admin edits via `/api/admin/attendance`, biometric ingest via `/api/biometric/log`).
3. Teacher portal is minimal: `app/teacher/` contains only dashboard (own attendance + holidays), and salary pages. Teachers have no class lists, no homework submission, no marks entry.
4. Scale: ~108 pages, 186 API route files, ~70 Firestore collections, ~6,000 files in `apps/web`.

## Coverage note

`apps/mobile`, `apps/desktop`, `packages/shared` internals, `tests/`, and Storage rules were identified but not line-audited. See `AUDIT-PROGRESS.md`.
