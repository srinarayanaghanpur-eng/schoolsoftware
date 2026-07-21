# Mobile App — Teardown Audit & Rebuild Plan

Project: `apps/mobile` (Expo SDK 54 / React Native 0.81 / expo-router 6 / React 19)
Date: 2026-07-21
Scope audited: all 41 source files (~4,725 lines)
Decision inputs: data layer = **route through Next.js `/api`**; v1 scope = **all five workspaces**; design system = **deferred, teardown only for now**

---

## 1. Executive summary

The mobile app is not a mature UI carrying technical debt. It is a **design prototype with one real feature**.

Only the **teacher attendance** flow is genuinely wired end-to-end (GPS geofence → `/api/attendance/mark`). Four of the sixteen screens are pure mockups with hardcoded numbers shipped as if they were product. About 1,100 lines of "performance optimization" infrastructure exists that no screen imports. The design system is a partial token file that most screens ignore in favour of inline hex codes.

**Verdict: the teardown is correct and low-risk.** There is very little UI worth preserving, and almost all genuine business logic already lives in `packages/shared`, `lib/api.ts`, and the web app's API routes — outside the presentation layer entirely.

**Teardown size: 26 files, ~2,873 lines deleted. 15 files kept, 3 rewritten.**

---

## 2. Critical findings

### 2.1 Four screens ship fabricated data to users (SEVERITY: HIGH)

These render invented numbers with no data source. A parent opening the app today is shown a fee balance that is not theirs.

| File | Fabricated content |
|---|---|
| `app/parent.tsx` | `Rs 8,000` fee due, `94%` attendance, `FA-2` next exam — all string literals |
| `app/fees.tsx` | `Rs 8,000` amount due, "Term 2 fee due soon" |
| `app/accountant.tsx` | `Rs 1,51,000` collected today, "28 receipts", bar chart with hardcoded heights `[58, 24, 18, 10]` |
| `app/admin.tsx` | `642` students, `38/41` staff present |
| `app/payments.tsx` | Form with no submit handler — "Save draft" button does nothing |
| `app/reports.tsx` | Four tiles that all say "open the web dashboard" |

This is the single most important finding. It is also why "all five workspaces in v1" is **net-new feature development**, not a UI rebuild — see §6.

### 2.2 Firestore read amplification (SEVERITY: HIGH)

`lib/useTeacherAttendanceData.ts` opens three `onSnapshot` listeners on mount:
- `teachers/{id}` — 1 doc
- `attendance` where teacherId — **limit 180**
- `holidays` — **limit 370**

That is **~551 document reads per mount**, with a live listener held open. Compounding problems:

- The hook is called by `home.tsx`, `attendance.tsx`, `calendar.tsx`, `history.tsx`, and `profile.tsx`. It is **not shared state** — each screen that mounts opens its own independent set of three listeners. Navigating Home → Attendance → History triples the cost.
- `profile.tsx` calls it to display **three fields** (employeeId, phone, biometricUserId) and pays the full 551-read price.
- Holidays are fetched unfiltered at 370 docs — a full year — on every mount, for a calendar view that shows one month.

`app/people.tsx` separately does `getDocs(query(collection(db, "teachers"), limit(100)))` — 100 reads, no cache, no pagination, refetched on every visit.

### 2.3 Client bypasses RBAC (SEVERITY: HIGH)

`people.tsx`, `messages.tsx`, `attendance.tsx`, `useTeacherAttendanceData.ts` and `mobileSession.tsx` all read/write Firestore directly via the client SDK. The web app's `requirePermission()` / `roleHasPermission()` layer is never consulted — enforcement rests entirely on `firestore.rules`. `messages.tsx` performs a client-side `addDoc` to write messages.

Your chosen data-layer direction (route through `/api`) fixes this class of problem structurally. Only `lib/api.ts` `postAttendance()` does it correctly today.

### 2.4 Dead infrastructure — ~1,100 lines, zero call sites

| File | Lines | Status |
|---|---|---|
| `lib/lazyLoad.ts` | 214 | Imported by nothing except `usePerformance.ts` (itself mostly unused) |
| `lib/firebaseQueryOptimization.ts` | 249 | Imported only by `lazyLoad.ts` |
| `lib/cache/mobileCache.ts` | 172 | Reached only via the above chain |
| `lib/requestOptimization.ts` | 221 | Only `debounce`/`throttle` reachable |
| `lib/performanceMonitor.ts` | 247 | Two calls in `OptimizedAppLayout`, results never read |
| `lib/hooks/usePerformance.ts` | 222 | 9 exported hooks; **1** (`useBackgroundSyncStatus`) is used anywhere |

Verified by grep across the whole app: no screen imports any of these. This is a caching/optimization layer that was built and then never connected — which is also why §2.2 exists.

### 2.5 Layout and provider risks

- **`SafeAreaProvider` is never mounted anywhere in the app.** `useSafeAreaInsets()` is called in `lib/OptimizedAppLayout.tsx` and `components/Screen.tsx`. Verify on device: insets may silently resolve to zero, which would explain any notch/gesture-bar clipping.
- `OptimizedAppLayout` wraps *outside* `MobileSessionProvider` and outside expo-router's `Stack`, so it sits above anything the router might provide.
- It also mixes `SafeAreaView` (from `react-native`, Android no-op) with manual `Platform.OS === 'android' ? insets.top : 0` padding — two competing inset strategies in an 11-line component.

### 2.6 Tablet layout is unreachable on iOS

`components/Screen.tsx` contains ~130 lines of tablet side-rail layout gated on `width >= 768`. `app.json` sets `"supportsTablet": false`. On iOS this code can never execute; it runs only on large Android tablets. Dead-on-arrival for the primary target.

### 2.7 Design system fragmentation

`lib/mobileTheme.ts` defines a 24-colour palette. Adoption is partial and inconsistent:

- **Screens using the palette:** `index`, `reports`, `profile` (partially)
- **Screens hardcoding hex instead:** `home` (~30 literals: `#2c2f8d`, `#f7c548`, `#7d86a8`, `#1b1d32`…), `login` (~20), `attendance` (~18), `admin`, `parent`, `fees`, `payments`, `people`, `messages`, `Card`, `StatusPill`, `OfflineStatusIndicator`
- **Two different brand blues in use:** `#33368f` (palette.brand) vs `#3033a1` / `#2c2f8d` / `#2d3094` (inline)
- **Two different app backgrounds:** `#f3f4fb` (palette.ground) vs `#f5f6fd` (OptimizedAppLayout, login)
- **Two different card borders:** `#e3e6f1` (palette.line) vs `#e3e6f0` (Card.tsx, home.tsx)

Near-miss duplicates like `#e3e6f1` vs `#e3e6f0` are the signature of copy-paste drift.

### 2.8 Multiple competing component styles

| Element | Distinct implementations |
|---|---|
| **Button** | 7 — `home.checkIn`, `home.checkOut`, `attendance.primary`, `attendance.secondary`, `admin.heroButton` (pill), `parent.button`, `payments.button`, `accountant.button`, `login.button`. Radii vary 14/16/999; heights 48/50/52/54/56 |
| **Card** | 3 — `components/Card.tsx` (r16, border `#e3e6f0`), `login.formCard` (r24, shadow 18), `home.shortcut` (r18, border `#e3e6f0`) |
| **Hero banner** | 5 near-identical copies — `home`, `admin`, `parent`, `fees`, `accountant` each redefine `hero`/`eye`/`amount`/`sub` with the same values |
| **Text input** | 3 — `login.input` (r16), `payments.input` (r14), `messages` |
| **Chip / pill** | 3 — `StatusPill`, `payments.chip`, `admin.quickCode` |
| **Avatar** | 4 — `home.avatar` (46/r14), `profile.avatar` (72/r20), `people.avatar` (40/r12), `Screen.roleBadge` (38/r12) |
| **"Pressed" state** | Redefined identically in 7 files: `{ opacity: 0.82, transform: [{ scale: 0.985 }] }` |

### 2.9 Typography has no system

Font sizes in use: 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 22, 24, 28, 30, 34 — 17 distinct sizes, assigned ad hoc.
Font weights: `"600"`, `"700"`, `"800"`, `"900"` used interchangeably; `"900"` is applied to body text, labels, buttons and numerals alike, so there is no visual hierarchy.
Spacing values: 2,3,4,5,6,7,8,9,10,11,12,13,14,16,18,20,22,26,28 — no 4pt or 8pt grid.
Radii: 4,6,7,9,10,11,12,14,16,18,20,22,24,26,999.

### 2.10 Accessibility regressions

- **`allowFontScaling={false}` is applied to essentially every `<Text>` in the app** (~120 occurrences). This hard-disables OS font scaling and is a direct WCAG violation — users who set larger text get nothing.
- Navigation "icons" are text glyphs — `"H"`, `"A"`, `"M"`, `"L"`, `"Me"`, `"..."`, `"Rs"`, `"PPL"`, `"MSG"`, `"RPT"`, `"CAL"`, `"LOG"`. No icon font or SVG set is installed. Screen readers announce letters.
- Colour-only status signalling in `StatusPill` and `attendance` distance bar.
- No `accessibilityLabel` on most Pressables outside the nav bar; no focus management; no reduced-motion handling in `AnimatedEntrance`.

### 2.11 Navigation problems

- Routing is flat `expo-router` file-based with `headerShown: false`; navigation state lives in `components/Screen.tsx`, meaning **the nav bar is re-mounted and re-rendered on every screen** rather than persisting. No shared element or tab-state preservation, no route groups, no typed routes.
- `href` values are cast `as never` throughout (`item.href as never`, `dashboardPathForRole(...) as never`) — typed-routes safety is being actively suppressed in 6 places.
- `/profile` serves triple duty: it is "Me" for teachers, "More" for admins, and "Salary" for accountants — the accountant nav labels it Salary but it renders a profile card with no salary data.
- `settings_manager` role routes to `/profile` as a dead end labelled "Desktop only".
- Both `Screen.tsx` and `app/index.tsx` implement independent unauthenticated-redirect logic, and `login.tsx` implements a third redirect guard with its own `redirectedRef`.

### 2.12 Other

- `react-native-gesture-handler`, `expo-camera`, `expo-linking`, `expo-constants` are installed; **none are imported by any file**. `expo-camera` also declares a camera permission prompt in `app.json` that the app never uses — an app-store review risk.
- No `assets/` directory: no app icon, no splash screen, no adaptive icon configured.
- `app/index.tsx` and `components/Screen.tsx` both render an "Opening workspace..." loader with different styling.
- Attendance `Alert.alert` is the only feedback mechanism — no snackbar/toast system exists.

---

## 3. Teardown manifest

### 3.1 DELETE — presentation layer (26 files, ~2,873 lines)

**All screens** (`apps/mobile/app/`, 16 files, ~1,783 lines)
```
_layout.tsx  index.tsx  login.tsx  home.tsx  admin.tsx  parent.tsx
accountant.tsx  profile.tsx  people.tsx  messages.tsx  attendance.tsx
calendar.tsx  history.tsx  fees.tsx  payments.tsx  reports.tsx
```

**All components** (`apps/mobile/components/`, 5 files, ~489 lines)
```
Screen.tsx  Card.tsx  StatusPill.tsx  AnimatedEntrance.tsx  OfflineStatusIndicator.tsx
```

**UI shell & dead infrastructure** (`apps/mobile/lib/`, 4 files, ~601 lines)
```
OptimizedAppLayout.tsx        UI shell — extract usePerformanceOptimization first (§3.3)
mobileTheme.ts                palette + workspace theming — extract role routing first (§3.3)
lazyLoad.ts                   dead; Firestore-coupled, obsolete under API-first
firebaseQueryOptimization.ts  dead; Firestore-coupled, obsolete under API-first
```

> ⚠️ Before deleting `app/attendance.tsx`, note that it holds the **only real business flow in the app** (permission request → `getCurrentPositionAsync` → `getDistanceFromCampus` → `isInsideCampus` → `postAttendance`). The teardown script extracts it to `lib/attendance/useAttendanceMarking.ts` — see §3.3.

### 3.2 KEEP — business logic, untouched (11 files)

| File | Lines | Why |
|---|---|---|
| `lib/firebase.ts` | 46 | Firebase app/auth/db initialization |
| `lib/authStorage.ts` | 32 | Auth persistence + `clearMobileAuthStorage` |
| `lib/api.ts` | 37 | The correct pattern: token → `Authorization: Bearer` → `/api/*`. Becomes the foundation of the new data layer |
| `lib/mobileSession.tsx` | 178 | Auth context, role resolution, profile shape, logout. Production quality |
| `lib/backgroundSync.ts` | 220 | Offline queue + background fetch task |
| `lib/cache/mobileCache.ts` | 172 | AsyncStorage TTL cache — currently orphaned, but **required** by the new API-first offline layer |
| `lib/requestOptimization.ts` | 221 | `debounce` / `throttle` |
| `lib/performanceMonitor.ts` | 247 | Instrumentation; keep, wire to real metrics later |
| `types/firebase-shims.d.ts` | 61 | RN Firebase type shims |
| `types/firebase-auth.d.ts` | 5 | ditto |
| `metro.config.js`, `tsconfig.json` | — | Build config |

Also kept and unaffected: everything in `packages/shared` — `getAttendancePercentage`, `getDistanceFromCampus`, `isInsideCampus`, `DEFAULT_SETTINGS`, `ROLE_LABELS`, `isValidRole`, `employeeIdToInternalEmail`, all types and schemas. **No shared business logic is touched by this teardown.**

### 3.3 EXTRACT BEFORE DELETE (3 new files)

The teardown script creates these first, so no logic is lost:

| New file | Extracted from | Contents |
|---|---|---|
| `lib/roleRouting.ts` | `mobileTheme.ts` | `WorkspaceKind`, `workspaceForRole()`, `dashboardPathForRole()` — routing logic, not styling. `palette` and `themeForRole` are **not** carried over |
| `lib/appBootstrap.ts` | `OptimizedAppLayout.tsx` | `usePerformanceOptimization()` — background-sync init and teardown, with the UI shell stripped out |
| `lib/attendance/useAttendanceMarking.ts` | `app/attendance.tsx` | The full GPS geofence + mark flow as a headless hook returning `{ mark, distance, insideCampus, settings, busy }`. Zero UI |

### 3.4 REWRITE (1 file, deferred to build phase)

`lib/useTeacherAttendanceData.ts` (252 lines) — the logic (normalizers for `AttendanceRecord`/`Teacher`/`Holiday`, teacher-id resolution) is sound and worth keeping, but the three-listener Firestore access pattern is the cause of §2.2. Under the API-first decision this becomes a cached fetch against a new `/api/teacher/attendance-summary` endpoint. **Kept in place for now** so the extracted attendance hook still compiles; rewritten in Phase 2.

### 3.5 CONFIG CHANGES

- `app.json`: remove the unused `expo-camera` plugin and `CAMERA` permission; decide `supportsTablet` deliberately; add icon/splash once assets exist
- `package.json`: drop `expo-camera`, `expo-linking`, `expo-constants` unless the new build uses them; add `react-native-gesture-handler` to the entry file if kept (it currently does nothing)

---

## 4. Post-teardown state

After running the script, `apps/mobile` contains **no UI whatsoever** — no screens, no components, no theme. It will not build until Phase 1 begins, which is the intended state: there is no old UI left to accidentally mix with the new one.

```
apps/mobile/
├── app/                      (empty — expo-router has no routes)
├── lib/
│   ├── firebase.ts           KEEP
│   ├── authStorage.ts        KEEP
│   ├── api.ts                KEEP → grows into the data layer
│   ├── mobileSession.tsx     KEEP
│   ├── backgroundSync.ts     KEEP
│   ├── performanceMonitor.ts KEEP
│   ├── requestOptimization.ts KEEP
│   ├── roleRouting.ts        NEW (extracted)
│   ├── appBootstrap.ts       NEW (extracted)
│   ├── cache/mobileCache.ts  KEEP
│   ├── hooks/usePerformance.ts  KEEP (prune in Phase 1)
│   ├── attendance/useAttendanceMarking.ts  NEW (extracted)
│   └── useTeacherAttendanceData.ts  KEEP → rewrite Phase 2
├── types/                    KEEP
├── app.json  metro.config.js  package.json  tsconfig.json
```

---

## 5. Target architecture (for the build phase)

Feature-first, with a design system that nothing is allowed to bypass.

```
apps/mobile/
├── app/                          # expo-router routes ONLY — thin, no logic
│   ├── _layout.tsx               # providers: SafeArea → Theme → Session → Query → Stack
│   ├── (auth)/login.tsx
│   ├── (teacher)/_layout.tsx     # role-scoped tab groups
│   ├── (parent)/_layout.tsx
│   ├── (admin)/_layout.tsx
│   ├── (accountant)/_layout.tsx
│   └── (principal)/_layout.tsx
│
├── design-system/                # THE ONLY SOURCE OF UI. No hex outside this folder.
│   ├── tokens/                   colors · typography · spacing · radius · elevation · motion
│   ├── primitives/               Text · Box · Stack · Pressable · Icon
│   ├── components/               Button · Card · Input · Chip · Badge · Avatar · ListItem
│   ├── feedback/                 Snackbar · Dialog · BottomSheet · Toast
│   ├── states/                   Loading · Empty · Error · Skeleton · Offline
│   └── layout/                   AppShell · TabBar · TopBar · ScreenScaffold
│
├── features/                     # one folder per domain, all five workspaces
│   └── <attendance|fees|messages|people|reports|salary|...>/
│       ├── api/                  typed calls into lib/api
│       ├── hooks/                data + state, headless
│       ├── components/           feature UI, composed from design-system only
│       └── screens/              rendered by app/ routes
│
└── lib/                          # PRESERVED — auth, api client, cache, sync, utils
```

**Enforcement rules for the build phase:**
1. A lint rule bans raw hex/rgb literals outside `design-system/tokens/`.
2. A lint rule bans `StyleSheet.create` outside `design-system/`.
3. No screen may import `firebase/firestore` — all reads go through `features/*/api` → `lib/api`.
4. `allowFontScaling={false}` is banned; typography scales with OS settings.
5. Every list state must render one of the four canonical states (loading / empty / error / data).

---

## 6. Phased rebuild plan

| Phase | Deliverable | Notes |
|---|---|---|
| **0 — Teardown** | Run `mobile-ui-teardown.ps1`. 26 files deleted, 3 extracted. | ← you are here |
| **1 — Foundation** | Design tokens, primitives, core components, the four states, provider stack (incl. the missing `SafeAreaProvider`), icon set, typed routes. **No feature screens.** | Nothing else starts until this is signed off |
| **2 — Data layer** | `lib/api` client with auth, retry, timeout, offline queue and TTL cache. Rewrite `useTeacherAttendanceData` against a new aggregated endpoint. Kills §2.2 and §2.3. | Needs 3–5 new `/api` endpoints on the web app |
| **3 — Shell & navigation** | `AppShell`, role-aware tab groups, deep links, one single auth-redirect guard replacing today's three | |
| **4 — Teacher workspace** | Login, home, attendance, calendar, history, messages, profile | Only workspace with real data today — ships first and proves the system |
| **5 — Parent workspace** | Fees, exams, notices, attendance, messages | ⚠️ Currently 100% mock. Requires real endpoints — the web portal APIs exist and can be reused |
| **6 — Accountant** | Collections, payment entry, dues, salary | ⚠️ Currently 100% mock. Payment entry is a **financial write path** — needs the same server-side transaction/idempotency guarantees as `/api/admin/payments`. Do not build a client-side writer |
| **7 — Admin / Principal** | Dashboard, people, approvals, reports, messages | ⚠️ Currently 100% mock |
| **8 — Hardening** | a11y audit, 60fps profiling, offline testing, Firestore read budget verification, icon/splash assets, store config | |

**A note on the "all five workspaces" v1 scope:** Phases 5–7 are not UI rebuilds — those screens have no real implementation to rebuild. They are new features requiring new API endpoints, and they carry roughly 3–4× the effort of Phase 4. If you want something in users' hands sooner, shipping Phase 4 alone as v1 and adding workspaces incrementally would be the lower-risk path. Your call — the architecture above supports either.

---

## 7. Open items to confirm before Phase 1

1. **Design system choice** (deferred by you): React Native Paper v5 for literal Material 3, a fully custom system, or a hybrid.
2. **Icon set** — no icons exist today. `@expo/vector-icons` (Material Symbols) is the natural default.
3. **Brand colours** — which blue is canonical? `#33368f`, `#3033a1`, and `#2c2f8d` all currently claim to be the brand.
4. **Dark mode** — `app.json` pins `userInterfaceStyle: "light"`. Material 3 makes dark mode nearly free if tokens are built for it from day one; retrofitting later is expensive.
5. **Tablet** — support properly, or drop the breakpoint entirely?
