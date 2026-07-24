/**
 * Role → workspace routing. Pure routing logic, no styling.
 * Replaces the palette/theming half of the deleted lib/mobileTheme.ts —
 * all colour now lives in design-system/tokens.ts.
 */
import type { Role } from "@sri-narayana/shared/types/rbac";

export type WorkspaceKind =
  | "teacher"
  | "parent"
  | "admin"
  | "principal"
  | "accountant"
  | "desktop";

export function workspaceForRole(role?: Role): WorkspaceKind {
  if (role === "parent") return "parent";
  if (role === "accountant") return "accountant";
  if (role === "principal") return "principal";
  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "settings_manager") return "desktop";
  return "teacher";
}

export function dashboardPathForRole(role?: Role): string {
  switch (workspaceForRole(role)) {
    case "parent":
      return "/parent";
    case "admin":
      return "/admin";
    case "principal":
      return "/principal";
    case "accountant":
      return "/accountant";
    case "desktop":
      return "/desktop";
    default:
      return "/teacher";
  }
}

/** Short label shown in the profile header of each workspace. */
export function workspaceLabel(role?: Role): string {
  switch (workspaceForRole(role)) {
    case "parent":
      return "Parent";
    case "admin":
      return "Administrator";
    case "principal":
      return "Principal";
    case "accountant":
      return "Accounts";
    case "desktop":
      return "Desktop only";
    default:
      return "Teacher";
  }
}
