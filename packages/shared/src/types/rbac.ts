/**
 * Role-Based Access Control (RBAC) — single source of truth for roles,
 * modules, and per-role permissions. Used by both backend guards and
 * frontend nav/route gating.
 */

export const ROLES = ["super_admin", "principal", "accountant", "teacher", "parent", "settings_manager"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  principal: "Principal",
  accountant: "Accountant",
  teacher: "Teacher",
  parent: "Parent",
  settings_manager: "Admin"
};

/** Every feature area in the app. Frontend uses these to build the nav. */
export const MODULES = [
  "dashboard",
  "students",
  "staff",
  "attendance",
  "academics",
  "exams",
  "fees",
  "payroll",
  "transport",
  "bus_finance",
  "communication",
  "library",
  "hostel",
  "inventory",
  "reports",
  "settings",
  "academic_years",
  "users",
  "portal",
  "promotions",
  "sms"
] as const;
export type Module = (typeof MODULES)[number];

/** Actions a permission can grant. Permission string format: `${module}.${action}`. */
export const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "compose", "copy", "mark_sent", "templates"] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Module}.${Action}`;

/** Wildcard for admin = every permission. */
const ALL = "*" as const;

/**
 * Role → permissions. Use "*" for full access. Otherwise list explicit
 * `module.action` strings. Keep this conservative; widen as features land.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly (Permission | typeof ALL)[]> = {
  super_admin: [ALL],
  principal: [
    "dashboard.view",
    "students.view", "students.export",
    "staff.view",
    "attendance.view", "attendance.export", "attendance.approve",
    "academics.view",
    "exams.view", "exams.approve", "exams.export",
    "fees.view", "fees.export",
    "payroll.view", "payroll.approve",
    "transport.view",
    "communication.view", "communication.create",
    "reports.view", "reports.export",
    "academic_years.view",
    "promotions.view", "promotions.create", "promotions.approve",
    "settings.view",
    "sms.view", "sms.compose", "sms.copy", "sms.export", "sms.mark_sent", "sms.templates"
  ],
  accountant: [
    "dashboard.view",
    "students.view",
    "fees.view", "fees.create", "fees.edit", "fees.approve", "fees.export",
    "inventory.view", "inventory.create", "inventory.edit",
    "bus_finance.view", "bus_finance.create", "bus_finance.edit", "bus_finance.export",
    "reports.view", "reports.export",
    "academic_years.view"
  ],
  teacher: [
    "dashboard.view",
    "students.view",
    "attendance.view", "attendance.create", "attendance.edit",
    "academics.view", "academics.create", "academics.edit",
    "exams.view", "exams.create", "exams.edit",
    "communication.view",
    "academic_years.view"
  ],
  settings_manager: [
    "dashboard.view",
    "settings.view", "settings.create", "settings.edit", "settings.delete",
    "users.view", "users.create", "users.edit", "users.delete",
    "academic_years.view", "academic_years.create", "academic_years.edit", "academic_years.delete",
    "sms.view", "sms.templates"
  ],
  parent: ["portal.view"]
};

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  const grants = ROLE_PERMISSIONS[role];
  if (!grants) return false;
  return grants.includes(ALL) || grants.includes(permission);
}

export function canAccessModule(role: Role | undefined, module: Module): boolean {
  return hasPermission(role, `${module}.view`);
}

/** Modules a role may open — drives the frontend sidebar/nav. */
export function modulesForRole(role: Role | undefined): Module[] {
  return MODULES.filter((m) => canAccessModule(role, m));
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
