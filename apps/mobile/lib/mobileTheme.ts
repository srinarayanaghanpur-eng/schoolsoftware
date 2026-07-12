import type { Role } from "@sri-narayana/shared";

export const palette = {
  ground: "#f3f4fb",
  surface: "#ffffff",
  surface2: "#edeef7",
  ink: "#181a2c",
  ink2: "#575e7d",
  ink3: "#8a90ac",
  line: "#e3e6f1",
  lineStrong: "#d3d7e6",
  brand: "#33368f",
  brandDeep: "#23256a",
  brandSoft: "#4a4eb5",
  brandTint: "#ecedfb",
  gold: "#efaf1f",
  goldTint: "#fbf1d8",
  good: "#12915d",
  goodTint: "#e2f4ea",
  warn: "#cd8710",
  warnTint: "#fbf0d9",
  bad: "#d6425f",
  badTint: "#fbe5ea",
  parent: "#0e7c86",
  admin: "#8a3ca8",
  accountant: "#14764c"
};

export type WorkspaceKind = "teacher" | "parent" | "admin" | "accountant" | "desktop";

export type WorkspaceTheme = {
  workspace: WorkspaceKind;
  label: string;
  accent: string;
  accentDeep: string;
  tint: string;
  short: string;
};

export function workspaceForRole(role?: Role): WorkspaceKind {
  if (role === "parent") return "parent";
  if (role === "accountant") return "accountant";
  if (role === "admin" || role === "principal" || role === "super_admin") return "admin";
  if (role === "settings_manager") return "desktop";
  return "teacher";
}

export function dashboardPathForRole(role?: Role): string {
  const workspace = workspaceForRole(role);
  if (workspace === "admin") return "/admin";
  if (workspace === "accountant") return "/accountant";
  if (workspace === "parent") return "/parent";
  if (workspace === "desktop") return "/profile";
  return "/home";
}

export function themeForRole(role?: Role): WorkspaceTheme {
  const workspace = workspaceForRole(role);
  if (workspace === "parent") {
    return { workspace, label: "Parent", accent: palette.parent, accentDeep: "#0c6169", tint: "#e2f3f5", short: "PA" };
  }
  if (workspace === "admin") {
    return { workspace, label: "Admin", accent: palette.admin, accentDeep: "#5f2b78", tint: "#f2e6f6", short: "AD" };
  }
  if (workspace === "accountant") {
    return { workspace, label: "Accountant", accent: palette.accountant, accentDeep: "#0d5c3c", tint: "#e2f4ea", short: "AC" };
  }
  if (workspace === "desktop") {
    return { workspace, label: "Desktop only", accent: palette.ink2, accentDeep: palette.ink, tint: palette.surface2, short: "DS" };
  }
  return { workspace, label: "Teacher", accent: palette.brand, accentDeep: palette.brandDeep, tint: palette.brandTint, short: "TE" };
}
