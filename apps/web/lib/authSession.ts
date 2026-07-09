"use client";

import { doc, getDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import {
  ALL,
  ALL_KNOWN_PERMISSIONS,
  isValidRole,
  type Permission,
  type Role
} from "@sri-narayana/shared";
import { db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { refreshClaims } from "@/lib/authClaims";

export type AuthProfile = {
  uid: string;
  name: string;
  email?: string;
  role: Role;
};

export type ResolvedAuthSession = {
  profile: AuthProfile;
  role: Role;
  permissions?: Permission[];
};

export class AuthSessionError extends Error {
  code: "not-configured" | "profile-missing" | "role-missing" | "inactive" | "profile-check-failed";

  constructor(code: AuthSessionError["code"], message: string) {
    super(message);
    this.name = "AuthSessionError";
    this.code = code;
  }
}

export function destinationForRole(role: Role): string {
  if (role === "teacher") return "/teacher";
  if (role === "parent") return "/portal";
  if (role === "accountant") return "/admin/finance";
  if (role === "settings_manager") return "/admin/settings";
  return "/admin/dashboard";
}

export async function loadPermissionsForRole(role: Role): Promise<Permission[] | undefined> {
  try {
    const snapshot = await getDoc(doc(db, "roles", role));
    if (!snapshot.exists()) return undefined;
    const data = snapshot.data() as { permissions?: unknown };
    const raw = Array.isArray(data.permissions) ? data.permissions.filter((item): item is string => typeof item === "string") : [];
    return raw.includes(ALL) ? [...ALL_KNOWN_PERMISSIONS] : raw;
  } catch {
    return undefined;
  }
}

export async function resolveAuthSessionUser(user: User): Promise<ResolvedAuthSession> {
  if (!isFirebaseConfigured) {
    throw new AuthSessionError("not-configured", "Firebase is not configured yet. Add Firebase environment values to enable login.");
  }

  let data: { displayName?: unknown; name?: unknown; role?: unknown; status?: unknown } | undefined;
  let claims: Record<string, unknown> | undefined;

  try {
    claims = await refreshClaims(user);
    const snapshot = await getDoc(doc(db, "users", user.uid));
    if (!snapshot.exists()) {
      throw new AuthSessionError("profile-missing", "Your login profile is missing. Please contact admin.");
    }
    data = snapshot.data() as { displayName?: unknown; name?: unknown; role?: unknown; status?: unknown };
  } catch (error) {
    if (error instanceof AuthSessionError) throw error;
    throw new AuthSessionError("profile-check-failed", "Unable to verify your login profile. Please try again.");
  }

  const role = isValidRole(data.role) ? data.role : isValidRole(claims?.role) ? claims.role : undefined;
  if (!role) {
    throw new AuthSessionError("role-missing", "Your login role is missing. Please contact admin.");
  }

  if (typeof data.status === "string" && data.status !== "active") {
    throw new AuthSessionError("inactive", "Your login is inactive. Please contact admin.");
  }

  const displayName = typeof data.displayName === "string" && data.displayName.trim()
    ? data.displayName.trim()
    : typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : user.displayName?.trim() || user.email || "User";

  const permissions = await loadPermissionsForRole(role);

  return {
    profile: {
      uid: user.uid,
      name: displayName,
      email: user.email ?? undefined,
      role
    },
    role,
    permissions
  };
}
