# System Guide — understand the app in 10 minutes

A practical orientation to how this app is built, how the new RBAC + Academic Year
system works, and how to test it. Read top to bottom.

## 1. The big picture
```
apps/web        Next.js 14 web app (admin + teacher + future portals)   → deployed on Vercel
apps/mobile     Expo / React Native app (teacher GPS attendance)
packages/shared TypeScript shared by web + mobile: types, schemas, RBAC, business logic
tools/essl-bridge  Node script: reads the eSSL device → posts to /api/biometric/log
Firebase        Auth (login) + Firestore (database) + (project: teacher-nara)
```
- **Frontend** (pages/components) lives in `apps/web/app` and `apps/web/components`.
- **Backend** is Next.js API routes in `apps/web/app/api/**` (they run server-side, use the
  Firebase **admin** SDK via `apps/web/lib/firebaseAdmin.ts`, and bypass Firestore rules).
- **Shared contracts** (the source of truth both sides agree on) live in `packages/shared/src`.

## 2. How login & roles work (RBAC)
**Mental model:** a user has one **role**; a role grants a set of **permissions**
(`module.action`, e.g. `fees.create`); permissions decide what the UI shows and what the API allows.

Flow on login:
1. User signs in with employee ID + password → Firebase Auth (`apps/web/app/login/LoginClient.tsx`).
2. Their **role** comes from a Firebase **custom claim** (`token.claims.role`) or the
   `users/{uid}` Firestore doc.
3. `AuthGate` (`apps/web/components/AuthGate.tsx`) checks the role against the page's allowed roles.
4. Backend API routes re-check with `requireRole(...)` / `requirePermission(...)`
   (`apps/web/lib/apiUtils.ts`) — **never trust the frontend alone**.

**The single source of truth for roles/permissions:** `packages/shared/src/types/rbac.ts`
- `ROLES` — the 7 roles, `ROLE_LABELS` — display names
- `MODULES` — every feature area, `ROLE_PERMISSIONS` — who can do what
- Helpers: `hasPermission(role, perm)`, `canAccessModule(role, mod)`, `modulesForRole(role)`
- To change who can access what, **edit `ROLE_PERMISSIONS`** — both frontend nav and backend
  guards update automatically.

To **make someone a role**: `PATCH /api/admin/users/[uid]/role` (admin only). It sets the
custom claim + `users/{uid}` doc. The user must **log out/in** for the new role to take effect.

## 3. How Academic Years work
- Collection: `academic_years` (`{ name:"2026-27", startDate, endDate, isActive }`).
- **Exactly one** year is `isActive` at a time — activating one deactivates the rest
  (handled server-side in the activate endpoint).
- Future modules (exams, fees, attendance reports) will filter data by the active year.
- API: `apps/web/app/api/admin/academic-years/**`.

## 4. Where the data lives (Firestore collections)
`users` (role/status) · `teachers` · `students` · `attendance` · `attendance_logs` ·
`biometric_logs` · `salary_reports` · `payments` · `concessions` · `holidays` ·
`leave_requests` · `notifications` · `settings/school` · **`academic_years`** (new).

## 5. Run & test locally
```bash
# from repo root
npm run dev:web        # web app on http://localhost:3000  (first load compiles ~30s)
```
Admin login: **`SNHS` / `Snhs@2026`**.

**Test Phase 1 once Codex wires the UI:**
1. Log in as `SNHS` (admin).
2. Open **Academic Years** → create `2026-27` (start/end dates) → it shows as **Active**.
3. Create a second year `2025-26` → use **Set Active** → the badge moves to it.
4. Open **Users & Roles** → see the permission matrix; change a user's role → that user
   re-logs-in and sees a different nav.
5. The sidebar should only show modules `modulesForRole(role)` returns for the current user.

**Quick API sanity check (no UI needed)** — get a token in the browser console after login:
```js
await firebase.auth().currentUser.getIdToken()   // or use the app's auth
fetch("/api/admin/academic-years", { headers:{ Authorization:`Bearer ${TOKEN}` }}).then(r=>r.json())
```

## 6. Roadmap status
- **Phase 1 (RBAC + Academic Years)** — backend ✅ done · frontend in progress (Codex)
- Phase 2 — Exams & Marks, Communication
- Phase 3 — Online fee payment, HR/Payroll, Parent/Student portal
- Phase 4 — Transport, Library, Hostel, Inventory
- Phase 5 — Reports builder, Audit log, Multi-branch
(See `docs/FRONTEND_BRIEF_PHASE1.md` for the exact Phase-1 frontend contract.)

## 7. Key files to read (in order)
1. `packages/shared/src/types/rbac.ts` — roles & permissions
2. `packages/shared/src/types/models.ts` — all data shapes
3. `apps/web/lib/apiUtils.ts` — the API auth guards
4. `apps/web/app/api/admin/academic-years/route.ts` — a clean example API route
5. `apps/web/components/AuthGate.tsx` — how the frontend gates by role
6. `firestore.rules` — client-side data access rules
