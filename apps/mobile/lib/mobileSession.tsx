import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { ROLE_LABELS, type Role, isValidRole } from "@sri-narayana/shared";
import { auth, db } from "@/lib/firebase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearMobileAuthStorage, REMEMBER_CHOICE_KEY } from "@/lib/authStorage";
import { mobileCache } from "@/lib/cache/mobileCache";
import { ensurePushRegistration, unregisterPushToken } from "@/lib/pushNotifications";
import { dashboardPathForRole } from "@/lib/roleRouting";

export type MobileAuthStatus = "checking" | "unauthenticated" | "authenticated" | "error";

export type MobileUserProfile = {
  uid: string;
  role: Role;
  displayName: string;
  email?: string;
  employeeId?: string;
  internalEmail?: string;
  teacherId?: string;
  driverId?: string;
  vehicleId?: string;
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
const SESSION_CACHE_PREFIX = "@sri-narayana:mobile-session:";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Logout must never wait on the network. Push unregister and sign-out are
 * best-effort with a hard deadline so a slow request cannot freeze the UI.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
  ]);
}

async function readCachedProfile(uid: string): Promise<MobileUserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(`${SESSION_CACHE_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MobileUserProfile>;
    if (parsed.uid !== uid || !isValidRole(parsed.role) || typeof parsed.displayName !== "string") {
      return null;
    }
    return parsed as MobileUserProfile;
  } catch {
    return null;
  }
}

async function writeCachedProfile(profile: MobileUserProfile): Promise<void> {
  await AsyncStorage.setItem(
    `${SESSION_CACHE_PREFIX}${profile.uid}`,
    JSON.stringify(profile)
  ).catch(() => undefined);
}

async function clearCachedProfile(uid?: string | null): Promise<void> {
  if (!uid) return;
  await AsyncStorage.removeItem(`${SESSION_CACHE_PREFIX}${uid}`).catch(() => undefined);
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
  // Token + user doc are independent — fetch together, not one after the other.
  const [token, userSnapshot] = await Promise.all([
    user.getIdTokenResult(),
    getDoc(doc(db, "users", user.uid))
  ]);
  const userData = userSnapshot.exists() ? asRecord(userSnapshot.data()) : {};
  const claimRole = token.claims.role;
  const docRole = userData.role;
  // The Firestore users doc is authoritative (matches the web API); the token
  // claim is only a fallback while a role change propagates.
  const role = isValidRole(docRole) ? docRole : isValidRole(claimRole) ? claimRole : undefined;

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

  const driverId = role === "driver"
    ? asString(userData.driverId) ?? asString(token.claims.driverId)
    : undefined;
  let vehicleId = role === "driver"
    ? asString(userData.vehicleId) ?? asString(token.claims.vehicleId)
    : undefined;
  if (role === "driver" && driverId && !vehicleId) {
    const driverSnapshot = await getDoc(doc(db, "drivers", driverId)).catch(() => null);
    if (driverSnapshot?.exists()) vehicleId = asString(driverSnapshot.data().vehicleId);
  }

  return {
    uid: user.uid,
    role,
    displayName: asString(userData.displayName) ?? user.displayName ?? ROLE_LABELS[role],
    email: user.email ?? asString(userData.email),
    employeeId: asString(userData.employeeId) ?? asString(token.claims.employeeId),
    internalEmail: asString(userData.internalEmail),
    teacherId,
    driverId,
    vehicleId,
    status
  };
}

export function MobileSessionProvider({ children }: { children: React.ReactNode }) {
  const runRef = useRef(0);
  const retainedErrorRef = useRef<string | null>(null);
  const lastUidRef = useRef<string | null>(null);
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
      // No signed-in user: wipe every cache namespace so the next
      // account on this device cannot read the previous one's data.
      void clearCachedProfile(lastUidRef.current);
      lastUidRef.current = null;
      void mobileCache.clearAllNamespaces();
      return;
    }

    lastUidRef.current = nextUser.uid;
    setError(null);

    // Show the last verified profile immediately, then revalidate in the
    // background. This removes the Firestore round-trip from cold-start
    // blocking while still catching role/status changes.
    const [cached] = await Promise.all([
      readCachedProfile(nextUser.uid),
      mobileCache.setOwner(nextUser.uid)
    ]);
    if (currentRun !== getRun()) return;
    if (cached) {
      setProfile(cached);
      setStatus("authenticated");
    } else {
      setStatus("checking");
    }

    try {
      const nextProfile = await resolveMobileSession(nextUser);
      if (currentRun !== getRun()) return;
      setProfile(nextProfile);
      setStatus("authenticated");
      void writeCachedProfile(nextProfile);
      // Best-effort: register this device for push after the first paint.
      // Deferring avoids competing with the dashboard's initial data fetch.
      setTimeout(() => {
        if (currentRun === getRun()) void ensurePushRegistration();
      }, 1500);
    } catch (err) {
      if (currentRun !== getRun()) return;
      const message = err instanceof Error ? err.message : "Unable to verify your session.";
      setProfile(null);
      setError(message);
      retainedErrorRef.current = message;
      setStatus("error");
      await clearCachedProfile(nextUser.uid);
      await signOut(auth).catch(() => undefined);
      await clearMobileAuthStorage().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      void (async () => {
        if (nextUser) {
          try {
            // "Remember Me" was off at the last sign-in: drop the restored
            // session immediately so this launch starts logged out.
            const remembered = await AsyncStorage.getItem(REMEMBER_CHOICE_KEY);
            if (remembered === "0") {
              await signOut(auth).catch(() => undefined);
              return;
            }
          } catch {
            // Storage failure must never lock the user out — continue normally.
          }
        }
        runRef.current += 1;
        const currentRun = runRef.current;
        await applyUser(nextUser, currentRun, () => runRef.current);
      })();
    });
    return unsubscribe;
  }, [applyUser]);

  const refresh = useCallback(async () => {
    runRef.current += 1;
    const currentRun = runRef.current;
    await applyUser(auth.currentUser, currentRun, () => runRef.current);
  }, [applyUser]);

  const logout = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    // Flip the UI immediately. WorkspaceGuard will redirect to /login even if
    // a network call below is slow or offline.
    setUser(null);
    setProfile(null);
    setError(null);
    setStatus("unauthenticated");

    if (auth.currentUser) {
      // Unregister while the token is still valid, but never block logout.
      await withTimeout(unregisterPushToken(), 2000);
      await withTimeout(signOut(auth), 5000);
    }
    await Promise.allSettled([
      clearMobileAuthStorage(),
      clearCachedProfile(uid),
      mobileCache.clearAllNamespaces()
    ]);
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
