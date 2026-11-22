/**
 * Role → workspace routing. Pure routing logic, no styling.
 * Replaces the palette/theming half of the deleted lib/mobileTheme.ts —
 * all colour now lives in design-system/tokens.ts.
 */
import type { Role } from "@sri-narayana/shared";

export type WorkspaceKind =
  | "teacher"
  | "parent"
  | "admin"
  | "principal"
  | "accountant"
  | "driver"
  | "desktop"
  | "blocked";

export function workspaceForRole(role?: Role): WorkspaceKind {
  if (role === "parent") return "parent";
  if (role === "accountant") return "accountant";
  if (role === "principal") return "principal";
  if (role === "admin" || role === "super_admin") return "admin";
  if (role === "driver") return "driver";
  if (role === "settings_manager") return "desktop";
  if (role === "teacher") return "teacher";
  return "blocked";
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
    case "driver":
      return "/driver";
    case "desktop":
      return "/desktop";
    case "teacher":
      return "/teacher";
    default:
      return "/login";
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
    case "driver":
      return "Driver";
    case "desktop":
      return "Desktop only";
    case "teacher":
      return "Teacher";
    default:
      return "No workspace";
  }
}
