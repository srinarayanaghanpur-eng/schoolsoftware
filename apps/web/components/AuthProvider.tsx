"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import type { Permission, Role } from "@sri-narayana/shared";
import { clearAdminApiCacheForSignOut } from "@/lib/adminApiClient";
import { clearAuthStorage, markLogoutRedirect } from "@/lib/authStorage";
import { clearPayrollSessionId } from "@/lib/payrollSessionClient";
import { resolveAuthSessionUser, type AuthProfile } from "@/lib/authSession";

export type AuthStatus = "checking" | "unauthenticated" | "authenticated" | "error";

type AuthState = {
  status: AuthStatus;
  profile: AuthProfile | null;
  role?: Role;
  permissions?: Permission[];
  error: string | null;
};

type AuthContextValue = AuthState & {
  refreshAuth: () => Promise<void>;
  signOutAndClear: () => Promise<void>;
  clearAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const initialAuthState: AuthState = {
  status: "checking",
  profile: null,
  role: undefined,
  permissions: undefined,
  error: null
};

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Unable to verify your login session. Please sign in again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(initialAuthState);
  const resolveIdRef = useRef(0);
  const forcedErrorRef = useRef<string | null>(null);

  const signOutAndClear = useCallback(async () => {
    resolveIdRef.current += 1;
    forcedErrorRef.current = null;
    clearPayrollSessionId();
    clearAdminApiCacheForSignOut();
    markLogoutRedirect();
    try {
      if (isFirebaseConfigured) {
        await signOut(auth);
      }
    } catch {
      // Storage cleanup below must still run even if Firebase sign-out rejects.
    } finally {
      clearAuthStorage();
      setState({
        status: "unauthenticated",
        profile: null,
        role: undefined,
        permissions: undefined,
        error: null
      });
    }
  }, []);

  const resolveCurrentUser = useCallback(async (user = auth.currentUser) => {
    const resolveId = ++resolveIdRef.current;

    if (!isFirebaseConfigured) {
      setState({
        status: "unauthenticated",
        profile: null,
        role: undefined,
        permissions: undefined,
        error: "Firebase is not configured yet. Add Firebase environment values to enable login."
      });
      return;
    }

    if (!user) {
      const forcedError = forcedErrorRef.current;
      setState({
        status: forcedError ? "error" : "unauthenticated",
        profile: null,
        role: undefined,
        permissions: undefined,
        error: forcedError
      });
      return;
    }

    setState((current) => ({
      status: "checking",
      profile: current.profile,
      role: current.role,
      permissions: current.permissions,
      error: null
    }));

    try {
      const session = await resolveAuthSessionUser(user);
      forcedErrorRef.current = null;
      if (resolveId !== resolveIdRef.current) return;
      setState({
        status: "authenticated",
        profile: session.profile,
        role: session.role,
        permissions: session.permissions,
        error: null
      });
    } catch (error) {
      const message = messageFromError(error);
      forcedErrorRef.current = message;
      try {
        await signOut(auth);
      } catch {
        // ignore
      } finally {
        clearAuthStorage();
        clearAdminApiCacheForSignOut();
        clearPayrollSessionId();
      }
      if (resolveId !== resolveIdRef.current) return;
      setState({
        status: "error",
        profile: null,
        role: undefined,
        permissions: undefined,
        error: message
      });
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setState({
        status: "unauthenticated",
        profile: null,
        role: undefined,
        permissions: undefined,
        error: "Firebase is not configured yet. Add Firebase environment values to enable login."
      });
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void resolveCurrentUser(user);
    });

    return unsubscribe;
  }, [resolveCurrentUser]);

  useEffect(() => {
    const handleRbacUpdate = () => {
      if (auth.currentUser) void resolveCurrentUser(auth.currentUser);
    };
    window.addEventListener("snhs-rbac-updated", handleRbacUpdate);
    return () => window.removeEventListener("snhs-rbac-updated", handleRbacUpdate);
  }, [resolveCurrentUser]);

  const clearAuthError = useCallback(() => {
    forcedErrorRef.current = null;
    setState((current) => current.status === "error"
      ? {
          status: "unauthenticated",
          profile: null,
          role: undefined,
          permissions: undefined,
          error: null
        }
      : { ...current, error: null });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    refreshAuth: () => resolveCurrentUser(auth.currentUser),
    signOutAndClear,
    clearAuthError
  }), [clearAuthError, resolveCurrentUser, signOutAndClear, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
