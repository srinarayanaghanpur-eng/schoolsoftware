/**
 * Role-Based Access Control (RBAC) — single source of truth for roles,
 * modules, and per-role permissions. Used by both backend guards and
 * frontend nav/route gating.
 */

export const ROLES = ["super_admin", "admin", "principal", "accountant", "teacher", "receptionist", "parent", "student"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Administrator",
  principal: "Principal",
  accountant: "Accountant",
  teacher: "Teacher",
  receptionist: "Receptionist",
  parent: "Parent",
  student: "Student"
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
  "communication",
  "library",
  "hostel",
  "inventory",
  "reports",
  "settings",
  "academic_years",
  "users",
  "portal",
  "promotions"
] as const;
export type Module = (typeof MODULES)[number];

/** Actions a permission can grant. Permission string format: `${module}.${action}`. */
export const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;
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
  admin: [ALL],
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
    "settings.view"
  ],
  accountant: [
    "dashboard.view",
    "students.view",
    "fees.view", "fees.create", "fees.edit", "fees.approve", "fees.export",
    "payroll.view", "payroll.create", "payroll.edit", "payroll.export",
    "inventory.view", "inventory.create", "inventory.edit",
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
  receptionist: [
    "dashboard.view",
    "students.view", "students.create", "students.edit",
    "attendance.view",
    "communication.view", "communication.create",
    "transport.view",
    "academic_years.view"
  ],
  parent: ["portal.view"],
  student: ["portal.view"]
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
