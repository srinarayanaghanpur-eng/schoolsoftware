# Frontend Brief — Phase 1 (RBAC + Academic Years)

> For Codex (frontend UI/UX). Backend is being built in parallel. **Do not change backend
> files** (`apps/web/app/api/**`, `apps/web/lib/firebaseAdmin.ts`, `apps/web/lib/apiUtils.ts`,
> `packages/shared/**`). Build the UI against the contracts below.

## Stack & conventions
- **Next.js 14 App Router** + **TypeScript** + **Tailwind**. Web app lives in `apps/web`.
- Shared types/logic come from `@sri-narayana/shared` — **import, don't redefine**.
- Icons: `lucide-react`. Match the existing design tokens (see `apps/web/app/globals.css`,
  `apps/web/components/AppShell.tsx`, existing admin pages for the look & feel).
- **Auth for API calls:** every `/api/admin/**` route needs a Firebase ID token.
  ```ts
  import { auth } from "@sri-narayana/shared/firebase/client";
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/admin/academic-years", {
    headers: { Authorization: `Bearer ${token}` }
  });
  ```
  A `403` means the role lacks permission — show an "Access denied" state.

## Shared exports you MUST use (already in `@sri-narayana/shared`)
```ts
// Roles
ROLES            // ["admin","principal","accountant","teacher","receptionist","parent","student"]
ROLE_LABELS      // Record<Role,string> — display names, e.g. ROLE_LABELS.admin = "Administrator"
type Role

// Modules & permissions
MODULES          // feature areas, e.g. "students","exams","fees","academic_years"...
type Module
type Permission  // `${Module}.${Action}` e.g. "fees.view"
ROLE_PERMISSIONS // Record<Role, Permission[] | ["*"]>  (admin = ["*"])

// Helpers (use these to gate nav & routes)
hasPermission(role, "fees.create") // boolean
canAccessModule(role, "fees")      // boolean
modulesForRole(role)               // Module[] — drives the sidebar
isValidRole(value)

// Academic year
type AcademicYear  // { id, name, startDate, endDate, isActive, createdAt, updatedAt }
academicYearCreateSchema // zod schema for the create form
```

---

## Frontend task 1 — Role-aware sidebar / navigation
Drive the admin sidebar from the signed-in user's role:
- Get the role from the auth token claim (or the `users/{uid}` doc `role`).
- Render nav items only for `modulesForRole(role)`.
- Hide action buttons the role can't do: e.g. only show "Add Year" if `hasPermission(role,"academic_years.view")` AND role is admin/principal (write rule below).
- The 7 roles need sensible nav. `parent`/`student` only get the **portal** module.

## Frontend task 2 — Academic Year management
A page at `apps/web/app/admin/academic-years/page.tsx` (client component).

**API contract (already live):**

`GET /api/admin/academic-years`
→ `{ ok: true, years: AcademicYear[] }` (sorted newest first; one has `isActive: true`)

`POST /api/admin/academic-years` (admin/principal only)
body: `{ name: "2026-27", startDate: "2026-06-01", endDate: "2027-04-30", isActive?: boolean }`
→ `{ ok: true, id }` or `{ ok: false, error }`

**Also live now:**
- `PATCH /api/admin/academic-years/[id]` — edit a year (admin/principal). Body: partial of create schema → `{ ok }`
- `POST /api/admin/academic-years/[id]/activate` — make it the active year, deactivates others (admin/principal) → `{ ok }`
- `DELETE /api/admin/academic-years/[id]` — admin only; **fails if the year is active** → `{ ok }` or `{ ok:false, error }`

**UI to build:**
- Table/list of years: name, date range, an **Active** badge on the current one.
- "Add Academic Year" modal/form (name `2026-27`, start date, end date, "set as active" toggle). Validate with `academicYearCreateSchema`.
- "Set Active" action per row (calls the activate endpoint).
- Empty state when there are no years.

## Frontend task 3 — Academic Year switcher (header)
- A dropdown in the top bar showing the **active** year, listing all years.
- Selecting one calls the activate endpoint and refreshes.
- Persist the chosen year in context so other pages can read it (Phase 2 modules will filter by year).

## Frontend task 4 — Users & Roles screen (read-only matrix for now)
- A page showing the **permission matrix**: rows = `MODULES`, columns = `ROLES`, cell = ✓/✗ from
  `hasPermission(role, \`${module}.view\`)` (and other actions if you want a detailed view).
- A user list with a **role dropdown** per user. Assign-role API is **live**:
  `PATCH /api/admin/users/[uid]/role` (admin only), body `{ role: Role }` → `{ ok, uid, role }`.
  (Sets the Firebase custom claim + `users/{uid}` doc; the user must re-login for the new role to apply.)

---

## Design notes
- Reuse existing components: `PageHeader`, `card`/`field`/`btn-primary` classes, `MetricCard` style.
- Keep it responsive (desktop + tablet + mobile).
- Loading states use the existing `BrandLoader` (`@/components/BrandLoader`).

## Backend status for Phase 1 — ✅ ALL DONE
- ✅ RBAC system in `@sri-narayana/shared`
- ✅ `GET/POST /api/admin/academic-years`
- ✅ academic-years `[id]` PATCH / DELETE / activate
- ✅ `PATCH /api/admin/users/[uid]/role` (assign role + Firebase custom claim)
- ✅ Firestore rules for `academic_years` (single-field queries — no composite index needed)
- ✅ Typecheck passes

Every Phase 1 endpoint is live. Ping me when the UI is wired and I'll move to
**Phase 2 (Exams & Marks, Communication)** and send the next brief.
