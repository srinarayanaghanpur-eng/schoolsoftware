import type { UserRole } from "@sri-narayana/shared";

/**
 * Centralised route → allowed-roles map. This is the authoritative source of
 * truth for which roles may OPEN a route, used by both the AuthGate (redirects
 * unauthorised users to /unauthorized) and the AppShell (hides nav links and
 * renders Access Denied for blocked sub-routes).
 *
 * Notes on this codebase (differs from a generic spec):
 *  - Parents AND students share the /portal/* area (there is no /parent or
 *    /student route).
 *  - There is no "staff" role; the teacher portal is teacher-only.
 *  - /admin is a shared back-office panel, not an "admin-role-only" area.
 *
 * Matching is longest-prefix wins, so more specific rules (e.g. /admin/finance)
 * override the broad /admin back-office rule.
 */
export type RoutePermission = { path: string; roles: readonly UserRole[] };

/** Roles that may enter the back-office panel at all. Finer access inside is
 *  still governed by the module RBAC matrix (modulesForRole) + the rules below. */
export const BACK_OFFICE_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "principal",
  "accountant",
  "settings_manager"
];

export const routePermissions: RoutePermission[] = [
  // Sensitive sub-areas (more specific than /admin, so they win the prefix match)
  { path: "/admin/finance", roles: ["super_admin", "accountant"] },
  { path: "/admin/fee-reminders", roles: ["super_admin", "admin", "accountant"] },
  { path: "/admin/settings", roles: ["super_admin", "settings_manager"] },
  // Academic-year management is super_admin / settings_manager only.
  { path: "/admin/settings/academic-years", roles: ["super_admin", "settings_manager"] },
  { path: "/admin/ai-agent/settings", roles: ["super_admin", "admin"] },
  { path: "/admin/ai-agent", roles: BACK_OFFICE_ROLES },
  { path: "/admin/users", roles: BACK_OFFICE_ROLES },
  { path: "/admin/roles", roles: BACK_OFFICE_ROLES },

  // Portals
  { path: "/teacher", roles: ["teacher"] },
  { path: "/portal", roles: ["parent"] },

  // Back-office catch-all (least specific)
  { path: "/admin", roles: BACK_OFFICE_ROLES }
];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Roles allowed to open `pathname`, or `null` when the route is public/unguarded
 * (e.g. /login). Longest matching prefix wins.
 */
export function rolesForPath(pathname: string): readonly UserRole[] | null {
  let best: RoutePermission | null = null;
  for (const rule of routePermissions) {
    if (matchesPrefix(pathname, rule.path) && (!best || rule.path.length > best.path.length)) {
      best = rule;
    }
  }
  return best ? best.roles : null;
}

/** True if `role` may open `pathname`. Unguarded routes are allowed for everyone. */
export function isRoleAllowedForPath(pathname: string, role: UserRole | undefined): boolean {
  const allowed = rolesForPath(pathname);
  if (!allowed) return true;
  return Boolean(role && allowed.includes(role));
}
