/**
 * WorkspaceGuard — per-workspace role gate for deep links and push taps.
 * The root index.tsx only guards cold starts; a route opened directly
 * (notification, link) lands inside a role layout without passing through /.
 * Each role _layout wraps its navigator in this guard: wrong role bounces to
 * the correct dashboard, logged-out bounces to /login with a return target
 * the login screen consumes after sign-in.
 */
import React, { useEffect, useState } from "react";
import { useRouter, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Role } from "@sri-narayana/shared";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole } from "@/lib/roleRouting";

/** Saved deep-link target, consumed once by the login screen. */
export const LOGIN_RETURN_KEY = "@sri-narayana:login-return";

export function WorkspaceGuard({ allowed, children }: { allowed: Role[]; children: React.ReactNode }) {
  const session = useMobileSession();
  const router = useRouter();
  const segments = useSegments();
  const [ok, setOk] = useState(false);
  const allowedKey = allowed.join(",");
  const path = `/${segments.join("/")}`;

  useEffect(() => {
    if (session.status === "checking") return;
    if (session.status !== "authenticated" || !session.profile) {
      setOk(false);
      if (path !== "/login" && path !== "/") {
        void AsyncStorage.setItem(LOGIN_RETURN_KEY, path).catch(() => undefined);
      }
      router.replace("/login" as never);
      return;
    }
    if (!allowed.includes(session.profile.role)) {
      setOk(false);
      router.replace(dashboardPathForRole(session.profile.role) as never);
      return;
    }
    setOk(true);
  }, [session.status, session.profile, allowedKey, path, router]);

  if (!ok) return null;
  return <>{children}</>;
}
