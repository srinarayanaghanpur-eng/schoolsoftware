/**
 * Role-Based Access Control (RBAC) — single source of truth for roles,
 * modules, and per-role permissions. Used by both backend guards and
 * frontend nav/route gating.
 */

export const ROLES = ["super_admin", "admin", "principal", "accountant", "teacher", "parent", "settings_manager"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  principal: "Principal",
  accountant: "Accountant",
  teacher: "Teacher",
  parent: "Parent",
  settings_manager: "Settings Manager"
};

/** Every feature area in the app. Frontend uses these to build the nav. */
export const MODULES = [
  "dashboard",
  "students",
  "parents",
  "staff",
  "attendance",
  "academics",
  "exams",
  "fees",
  "fee_reminders",
  "salary",
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
  "roles",
  "permissions",
  "portal",
  "promotions",
  "certificates",
  "ai_agent"
] as const;
export type Module = (typeof MODULES)[number];

/** Actions a permission can grant. Permission string format: `${module}.${action}`. */
export const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "manage"] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = string;

/** Wildcard for admin = every permission. */
export const ALL = "*" as const;

export type PermissionGroup = {
  key: string;
  label: string;
  permissions: readonly Permission[];
};

export const PERMISSION_MATRIX: readonly PermissionGroup[] = [
  { key: "dashboard", label: "Dashboard", permissions: ["dashboard.view"] },
  { key: "students", label: "Students", permissions: ["students.view", "students.create", "students.edit", "students.delete"] },
  { key: "parents", label: "Parents", permissions: ["parents.view", "parents.create", "parents.edit", "parents.delete"] },
  { key: "staff", label: "Staff", permissions: ["staff.view", "staff.create", "staff.edit", "staff.delete"] },
  { key: "attendance", label: "Attendance", permissions: ["attendance.view", "attendance.create", "attendance.edit", "attendance.delete"] },
  { key: "fees", label: "Fees & Finance", permissions: ["fees.view", "fees.create", "fees.edit", "fees.delete", "fees.approve", "fees.export"] },
  { key: "fee_reminders", label: "Fee Reminders", permissions: ["fee_reminders.view", "fee_reminders.manage_settings", "fee_reminders.send_test", "fee_reminders.retry_failed", "fee_reminders.export_logs"] },
  { key: "salary", label: "Salary & Payroll", permissions: ["salary.view", "salary.create", "salary.edit", "salary.delete", "payroll.view", "payroll.create", "payroll.edit", "payroll.approve"] },
  { key: "exams", label: "Exams & Marks", permissions: ["exams.view", "exams.create", "exams.edit", "exams.delete", "exams.approve", "exams.export"] },
  { key: "communication", label: "Communication", permissions: ["communication.view", "communication.create", "communication.edit", "communication.delete"] },
  { key: "reports", label: "Reports", permissions: ["reports.view", "reports.export"] },
  { key: "settings", label: "Settings", permissions: ["settings.view", "settings.create", "settings.edit", "settings.delete"] },
  { key: "users", label: "Users & Roles", permissions: ["users.view", "users.create", "users.edit", "users.delete", "roles.view", "roles.edit", "roles.manage", "permissions.view", "permissions.edit", "permissions.manage"] },
  { key: "ai_agent", label: "AI Agent", permissions: ["ai_agent.view", "ai_agent.chat", "ai_agent.settings", "ai_agent.logs", "ai_agent.generate_notice", "ai_agent.generate_fee_message", "ai_agent.summarize_reports", "ai_agent.quota"] },
  { key: "certificates", label: "Certificates", permissions: ["certificates.view", "certificates.create", "certificates.edit", "certificates.delete"] }
] as const;

export const SUPER_ADMIN_CRITICAL_PERMISSIONS: readonly Permission[] = [
  "settings.view",
  "settings.edit",
  "users.view",
  "users.edit",
  "roles.manage",
  "permissions.manage"
] as const;

export const SELF_LOCK_PERMISSIONS: readonly Permission[] = [
  "users.view",
  "users.edit",
  "roles.manage",
  "permissions.manage",
  "settings.view"
] as const;

export const MATRIX_PERMISSIONS = Array.from(new Set(PERMISSION_MATRIX.flatMap((group) => group.permissions))).sort();

export const LEGACY_PERMISSIONS: readonly Permission[] = [
  "academic_years.view", "academic_years.create", "academic_years.edit", "academic_years.delete",
  "academics.view", "academics.create", "academics.edit", "academics.delete",
  "bus_finance.view", "bus_finance.create", "bus_finance.edit", "bus_finance.delete", "bus_finance.export",
  "hostel.view", "hostel.create", "hostel.edit", "hostel.delete",
  "inventory.view", "inventory.create", "inventory.edit", "inventory.delete",
  "library.view", "library.create", "library.edit", "library.delete",
  "certificates.view", "certificates.create", "certificates.edit", "certificates.delete",
  "portal.view",
  "promotions.view", "promotions.create", "promotions.edit", "promotions.delete", "promotions.approve",
  "transport.view", "transport.create", "transport.edit", "transport.delete"
] as const;

export const ALL_KNOWN_PERMISSIONS = Array.from(new Set([...MATRIX_PERMISSIONS, ...LEGACY_PERMISSIONS])).sort();

/**
 * Role → permissions. Use "*" for full access. Otherwise list explicit
 * `module.action` strings. Keep this conservative; widen as features land.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly (Permission | typeof ALL)[]> = {
  super_admin: [ALL],
  admin: [
    "dashboard.view",
    "students.view", "students.create", "students.edit", "students.delete",
    "parents.view", "parents.create", "parents.edit", "parents.delete",
    "staff.view", "staff.create", "staff.edit",
    "attendance.view", "attendance.create", "attendance.edit",
    "academics.view", "academics.create", "academics.edit",
    "exams.view", "exams.create", "exams.edit", "exams.export",
    "fees.view", "fees.create", "fees.edit", "fees.approve", "fees.export",
    "fee_reminders.view", "fee_reminders.manage_settings", "fee_reminders.send_test", "fee_reminders.retry_failed", "fee_reminders.export_logs",
    "salary.view", "salary.create", "salary.edit", "payroll.view", "payroll.create", "payroll.edit", "payroll.approve",
    "transport.view", "transport.create", "transport.edit",
    "communication.view", "communication.create", "communication.edit",
    "reports.view", "reports.export",
    "settings.view", "settings.create", "settings.edit",
    "users.view", "users.create", "users.edit",
    "roles.view", "roles.edit",
    "permissions.view", "permissions.edit",
    "academic_years.view", "academic_years.create", "academic_years.edit",
    "promotions.view", "promotions.create", "promotions.approve",
    "certificates.view", "certificates.create", "certificates.edit",
    "ai_agent.view", "ai_agent.chat", "ai_agent.settings", "ai_agent.logs",
    "ai_agent.generate_notice", "ai_agent.generate_fee_message", "ai_agent.summarize_reports", "ai_agent.quota"
  ],
  principal: [
    "dashboard.view",
    "students.view", "students.export",
    "parents.view",
    "staff.view",
    "attendance.view", "attendance.export", "attendance.approve",
    "academics.view",
    "exams.view", "exams.approve", "exams.export",
    "fees.view", "fees.export",
    "bus_finance.view", "bus_finance.export",
    "salary.view", "payroll.view", "payroll.approve",
    "transport.view",
    "communication.view", "communication.create",
    "reports.view", "reports.export",
    "academic_years.view",
    "promotions.view", "promotions.create", "promotions.approve",
    "certificates.view", "certificates.create",
    "settings.view",
    "ai_agent.view", "ai_agent.chat", "ai_agent.generate_notice", "ai_agent.summarize_reports", "ai_agent.quota"
  ],
  accountant: [
    "dashboard.view",
    "students.view",
    "parents.view",
    "fees.view", "fees.create", "fees.edit", "fees.approve", "fees.export",
    "fee_reminders.view", "fee_reminders.manage_settings", "fee_reminders.send_test", "fee_reminders.retry_failed", "fee_reminders.export_logs",
    "inventory.view", "inventory.create", "inventory.edit",
    "bus_finance.view", "bus_finance.create", "bus_finance.edit", "bus_finance.export",
    "reports.view", "reports.export",
    "academic_years.view",
    "ai_agent.view", "ai_agent.chat", "ai_agent.generate_fee_message", "ai_agent.summarize_reports", "ai_agent.quota"
  ],
  teacher: [
    "dashboard.view",
    "students.view",
    "attendance.view", "attendance.create", "attendance.edit",
    "academics.view", "academics.create", "academics.edit",
    "exams.view", "exams.create", "exams.edit",
    "communication.view",
    "certificates.view",
    "academic_years.view"
  ],
  settings_manager: [
    "dashboard.view",
    "settings.view", "settings.create", "settings.edit", "settings.delete",
    "users.view", "users.create", "users.edit", "users.delete",
    "roles.view", "roles.edit", "roles.manage",
    "permissions.view", "permissions.edit", "permissions.manage",
    "academic_years.view", "academic_years.create", "academic_years.edit", "academic_years.delete",
    "ai_agent.view", "ai_agent.settings", "ai_agent.logs", "ai_agent.quota"
  ],
  parent: ["portal.view"]
};

export function hasPermission(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  const grants = ROLE_PERMISSIONS[role];
  if (!grants) return false;
  return grants.includes(ALL) || grants.includes(permission);
}

export function defaultPermissionsForRole(role: Role): Permission[] {
  const grants = ROLE_PERMISSIONS[role] ?? [];
  const permissions = grants.includes(ALL) ? ALL_KNOWN_PERMISSIONS : grants.filter((item): item is Permission => item !== ALL);
  const withRequired = role === "super_admin" ? [...permissions, ...SUPER_ADMIN_CRITICAL_PERMISSIONS] : permissions;
  return Array.from(new Set(withRequired)).sort();
}

export function hasPermissionFromList(role: Role | undefined, permissions: readonly Permission[] | undefined, permission: Permission): boolean {
  if (!role) return false;
  if (!permissions) return hasPermission(role, permission);
  if (role === "super_admin" && SUPER_ADMIN_CRITICAL_PERMISSIONS.includes(permission)) return true;
  if (permissions.includes(ALL)) return true;
  return permissions.includes(permission);
}

export function canAccessModule(role: Role | undefined, module: Module): boolean {
  return hasPermission(role, `${module}.view`);
}

export function canAccessModuleFromList(role: Role | undefined, permissions: readonly Permission[] | undefined, module: Module): boolean {
  return hasPermissionFromList(role, permissions, `${module}.view`);
}

/** Modules a role may open — drives the frontend sidebar/nav. */
export function modulesForRole(role: Role | undefined): Module[] {
  return MODULES.filter((m) => canAccessModule(role, m));
}

export function modulesForRoleFromList(role: Role | undefined, permissions: readonly Permission[] | undefined): Module[] {
  return MODULES.filter((m) => canAccessModuleFromList(role, permissions, m));
}

export function isValidRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
