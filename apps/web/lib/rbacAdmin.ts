import { FieldValue } from "firebase-admin/firestore";
import {
  ALL,
  ALL_KNOWN_PERMISSIONS,
  ROLE_LABELS,
  ROLES,
  SELF_LOCK_PERMISSIONS,
  SUPER_ADMIN_CRITICAL_PERMISSIONS,
  defaultPermissionsForRole,
  hasPermission,
  isValidRole,
  type Permission,
  type Role
} from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";

export type RoleDocument = {
  slug: Role;
  label: string;
  permissions: Permission[];
  updatedAt?: unknown;
  updatedBy?: string;
};

export const ROLE_COLLECTION = "roles";

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function normalizePermissionList(value: unknown): Permission[] {
  if (!Array.isArray(value)) return [];
  return uniqueSorted(value.filter((item): item is string => typeof item === "string"));
}

export function isKnownPermission(permission: string): permission is Permission {
  return ALL_KNOWN_PERMISSIONS.includes(permission);
}

export function isSuperAdminCriticalPermission(permission: string) {
  return SUPER_ADMIN_CRITICAL_PERMISSIONS.includes(permission);
}

export function isSelfLockPermission(permission: string) {
  return SELF_LOCK_PERMISSIONS.includes(permission);
}

export function fallbackPermissionsForRole(role: Role): Permission[] {
  return defaultPermissionsForRole(role);
}

export async function getRoleDocument(role: Role): Promise<RoleDocument | null> {
  const snap = await adminDb().collection(ROLE_COLLECTION).doc(role).get();
  if (!snap.exists) return null;
  const data = snap.data() ?? {};
  const permissions = normalizePermissionList(data.permissions);
  return {
    slug: role,
    label: String(data.label || ROLE_LABELS[role]),
    permissions: role === "super_admin" ? uniqueSorted([...permissions, ...SUPER_ADMIN_CRITICAL_PERMISSIONS]) : permissions,
    updatedAt: data.updatedAt,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : undefined
  };
}

export async function getEffectiveRolePermissions(role: Role): Promise<Permission[]> {
  const doc = await getRoleDocument(role);
  return doc?.permissions ?? fallbackPermissionsForRole(role);
}

export async function roleHasPermission(role: Role | undefined, permission: Permission): Promise<boolean> {
  if (!role) return false;
  if (role === "super_admin") return true;
  const doc = await getRoleDocument(role);
  if (!doc) return hasPermission(role, permission);
  if (doc.permissions.includes(ALL)) return true;
  return doc.permissions.includes(permission);
}

export async function roleHasAllPermissions(role: Role | undefined, permissions: readonly Permission[]): Promise<boolean> {
  if (!role) return false;
  if (role === "super_admin") return true;
  const effective = await getEffectiveRolePermissions(role);
  return permissions.every((p) => effective.includes(ALL) || effective.includes(p));
}

export async function roleHasAnyPermission(role: Role | undefined, permissions: readonly Permission[]): Promise<boolean> {
  if (!role) return false;
  if (role === "super_admin") return true;
  const effective = await getEffectiveRolePermissions(role);
  return permissions.some((p) => effective.includes(ALL) || effective.includes(p));
}

export async function ensureRoleDocuments(updatedBy = "system"): Promise<RoleDocument[]> {
  const db = adminDb();
  const result: RoleDocument[] = [];
  for (const role of ROLES) {
    const ref = db.collection(ROLE_COLLECTION).doc(role);
    const snap = await ref.get();
    if (!snap.exists) {
      const permissions = fallbackPermissionsForRole(role);
      await ref.set({
        slug: role,
        label: ROLE_LABELS[role],
        permissions,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy
      });
      result.push({ slug: role, label: ROLE_LABELS[role], permissions, updatedBy });
      continue;
    }
    const data = snap.data() ?? {};
    const permissions = role === "super_admin"
      ? uniqueSorted([...normalizePermissionList(data.permissions), ...SUPER_ADMIN_CRITICAL_PERMISSIONS])
      : normalizePermissionList(data.permissions);
    if (role === "super_admin" && permissions.length !== normalizePermissionList(data.permissions).length) {
      await ref.set({ slug: role, label: ROLE_LABELS[role], permissions, updatedAt: FieldValue.serverTimestamp(), updatedBy }, { merge: true });
    }
    result.push({ slug: role, label: String(data.label || ROLE_LABELS[role]), permissions, updatedAt: data.updatedAt, updatedBy: String(data.updatedBy || "") });
  }
  return result;
}

export async function updateRolePermission(params: {
  role: Role;
  permission: Permission;
  allowed: boolean;
  changedBy: string;
  changedByName?: string;
}) {
  const db = adminDb();
  const ref = db.collection(ROLE_COLLECTION).doc(params.role);
  const snap = await ref.get();
  const basePermissions = snap.exists ? normalizePermissionList(snap.data()?.permissions) : fallbackPermissionsForRole(params.role);
  const next = new Set(basePermissions);
  const wasAllowed = next.has(params.permission);

  if (params.allowed) next.add(params.permission);
  else next.delete(params.permission);
  if (params.role === "super_admin") {
    SUPER_ADMIN_CRITICAL_PERMISSIONS.forEach((permission) => next.add(permission));
  }

  const permissions = uniqueSorted(Array.from(next));
  await ref.set({
    slug: params.role,
    label: ROLE_LABELS[params.role],
    permissions,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: params.changedBy
  }, { merge: true });

  const action = params.allowed ? "added" : "removed";
  if (wasAllowed !== params.allowed) {
    await db.collection("audit_logs").add({
      type: "permission_update",
      role: params.role,
      permission: params.permission,
      action,
      changedBy: params.changedBy,
      changedByName: params.changedByName ?? "",
      createdAt: FieldValue.serverTimestamp()
    });
  }

  return { role: params.role, permission: params.permission, allowed: params.allowed, permissions, action };
}

export function parseRole(value: unknown): Role | null {
  return isValidRole(value) ? value : null;
}
