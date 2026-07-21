import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { ROLE_LABELS, type Role, isValidRole } from "@sri-narayana/shared";
import { auth, db } from "@/lib/firebase";
import { clearMobileAuthStorage } from "@/lib/authStorage";
import { dashboardPathForRole } from "@/lib/mobileTheme";

export type MobileAuthStatus = "checking" | "unauthenticated" | "authenticated" | "error";

export type MobileUserProfile = {
  uid: string;
  role: Role;
  displayName: string;
  email?: string;
  employeeId?: string;
  internalEmail?: string;
  teacherId?: string;
  status?: string;
};

type MobileSessionContextValue = {
  status: MobileAuthStatus;
  user: User | null;
  profile: MobileUserProfile | null;
  error: string | null;
  dashboardPath: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const MobileSessionContext = createContext<MobileSessionContextValue | null>(null);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function resolveTeacherId(user: User, userData: Record<string, unknown>, claimTeacherId: unknown) {
  const fromClaim = asString(claimTeacherId);
  if (fromClaim) return fromClaim;

  const fromUserDoc = asString(userData.teacherId);
  if (fromUserDoc) return fromUserDoc;

  const teacherSnapshot = await getDocs(
    query(collection(db, "teachers"), where("uid", "==", user.uid), limit(1))
  );
  return teacherSnapshot.empty ? undefined : teacherSnapshot.docs[0].id;
}

export async function resolveMobileSession(user: User): Promise<MobileUserProfile> {
  const token = await user.getIdTokenResult();
  const userSnapshot = await getDoc(doc(db, "users", user.uid));
  const userData = userSnapshot.exists() ? asRecord(userSnapshot.data()) : {};
  const claimRole = token.claims.role;
  const docRole = userData.role;
  const role = isValidRole(claimRole) ? claimRole : isValidRole(docRole) ? docRole : undefined;

  if (!role) {
    throw new Error("Your login role is missing. Please contact admin.");
  }

  const status = asString(userData.status) ?? asString(token.claims.status);
  if (status && status !== "active") {
    throw new Error("Your login is inactive. Please contact admin.");
  }

  const teacherId = role === "teacher"
    ? await resolveTeacherId(user, userData, token.claims.teacherId)
    : asString(userData.teacherId) ?? asString(token.claims.teacherId);

  return {
    uid: user.uid,
    role,
    displayName: asString(userData.displayName) ?? user.displayName ?? ROLE_LABELS[role],
    email: user.email ?? asString(userData.email),
    employeeId: asString(userData.employeeId) ?? asString(token.claims.employeeId),
    internalEmail: asString(userData.internalEmail),
    teacherId,
    status
  };
}

export function MobileSessionProvider({ children }: { children: React.ReactNode }) {
  const runRef = useRef(0);
  const retainedErrorRef = useRef<string | null>(null);
  const [status, setStatus] = useState<MobileAuthStatus>("checking");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MobileUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyUser = useCallback(async (nextUser: User | null, currentRun: number, getRun: () => number) => {
    setUser(nextUser);

    if (!nextUser) {
      setProfile(null);
      setError(retainedErrorRef.current);
      retainedErrorRef.current = null;
      setStatus("unauthenticated");
      return;
    }

    setError(null);
    setStatus("checking");
    try {
      const nextProfile = await resolveMobileSession(nextUser);
      if (currentRun !== getRun()) return;
      setProfile(nextProfile);
      setStatus("authenticated");
    } catch (err) {
      if (currentRun !== getRun()) return;
      const message = err instanceof Error ? err.message : "Unable to verify your session.";
      setProfile(null);
      setError(message);
      retainedErrorRef.current = message;
      setStatus("error");
      await signOut(auth).catch(() => undefined);
      await clearMobileAuthStorage().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      runRef.current += 1;
      const currentRun = runRef.current;
      void applyUser(nextUser, currentRun, () => runRef.current);
    });
    return unsubscribe;
  }, [applyUser]);

  const refresh = useCallback(async () => {
    runRef.current += 1;
    const currentRun = runRef.current;
    await applyUser(auth.currentUser, currentRun, () => runRef.current);
  }, [applyUser]);

  const logout = useCallback(async () => {
    await signOut(auth);
    await clearMobileAuthStorage();
    setUser(null);
    setProfile(null);
    setError(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<MobileSessionContextValue>(() => ({
    status,
    user,
    profile,
    error,
    dashboardPath: dashboardPathForRole(profile?.role),
    refresh,
    logout
  }), [status, user, profile, error, refresh, logout]);

  return (
    <MobileSessionContext.Provider value={value}>
      {children}
    </MobileSessionContext.Provider>
  );
}

export function useMobileSession() {
  const context = useContext(MobileSessionContext);
  if (!context) {
    throw new Error("useMobileSession must be used inside MobileSessionProvider");
  }
  return context;
}

export function isAdminWorkspaceRole(role?: Role) {
  return role === "admin" || role === "principal" || role === "super_admin" || role === "accountant" || role === "settings_manager";
}
