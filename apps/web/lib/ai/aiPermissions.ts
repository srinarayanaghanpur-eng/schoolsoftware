import type { Permission, Role } from "@sri-narayana/shared";
import { hasPermission as rbacHasPermission, hasPermissionFromList, ROLE_PERMISSIONS, ALL } from "@sri-narayana/shared";

export const AI_PERMISSIONS = {
  VIEW: "ai_agent.view",
  CHAT: "ai_agent.chat",
  SETTINGS: "ai_agent.settings",
  LOGS: "ai_agent.logs",
  GENERATE_NOTICE: "ai_agent.generate_notice",
  GENERATE_FEE_MESSAGE: "ai_agent.generate_fee_message",
  SUMMARIZE_REPORTS: "ai_agent.summarize_reports",
  QUOTA: "ai_agent.quota",
} as const;

export const AI_AGENT_PERMISSIONS: readonly Permission[] = [
  AI_PERMISSIONS.VIEW,
  AI_PERMISSIONS.CHAT,
  AI_PERMISSIONS.SETTINGS,
  AI_PERMISSIONS.LOGS,
  AI_PERMISSIONS.GENERATE_NOTICE,
  AI_PERMISSIONS.GENERATE_FEE_MESSAGE,
  AI_PERMISSIONS.SUMMARIZE_REPORTS,
  AI_PERMISSIONS.QUOTA,
];

/**
 * Check if a user has a given permission.
 * Supports three data sources in order:
 * 1. Explicit `permissions` array (from Firestore role document)
 * 2. Role-based default permissions from ROLE_PERMISSIONS config
 */
export function checkPermission(
  role: Role | undefined,
  permissions: readonly Permission[] | undefined,
  permission: Permission
): boolean {
  if (!role) return false;

  // super_admin always has all permissions
  if (role === "super_admin") return true;

  // If we have an explicit permissions list from Firestore, use it
  if (permissions && permissions.length > 0) {
    return hasPermissionFromList(role, permissions, permission);
  }

  // Fallback to RBAC config defaults
  return rbacHasPermission(role, permission);
}

/**
 * Check if a user has any of the given permissions.
 */
export function checkAnyPermission(
  role: Role | undefined,
  permissions: readonly Permission[] | undefined,
  requiredPermissions: readonly Permission[]
): boolean {
  if (!role) return false;
  if (role === "super_admin") return true;
  return requiredPermissions.some((p) => checkPermission(role, permissions, p));
}
