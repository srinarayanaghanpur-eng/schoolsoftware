"use client";

import { auth, db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { isValidRole, type UserRole } from "@sri-narayana/shared";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { refreshClaims } from "@/lib/authClaims";
import { rolesForPath } from "@/lib/routeAccess";
import { doc, getDoc } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandLoader } from "./BrandLoader";

const ROLE_HINT_KEY = "erp-auth-role";
const ROLE_HINT_TTL = 10 * 60 * 1000; // 10 minutes

function clearRoleHint() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ROLE_HINT_KEY);
  } catch {
    // ignore
  }
}

function writeRoleHint(role: UserRole) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ROLE_HINT_KEY, JSON.stringify({ role, at: Date.now() }));
  } catch {
    // ignore
  }
}

function readRoleHint(allowedRoles: readonly UserRole[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(ROLE_HINT_KEY);
    if (!raw) return false;
    const hint = JSON.parse(raw) as { role?: UserRole; at?: number };
    return Boolean(hint.role && allowedRoles.includes(hint.role) && typeof hint.at === "number" && Date.now() - hint.at < ROLE_HINT_TTL);
  } catch {
    return false;
  }
}

export function AuthGate({
  role,
  roles,
  children
}: {
  role?: UserRole;
  roles?: readonly UserRole[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Explicit role/roles props win; otherwise fall back to the central route
  // table so a layout can simply render <AuthGate> and get per-path rules.
  const allowedRoles = useMemo(() => {
    if (roles) return roles;
    if (role) return [role];
    return rolesForPath(pathname) ?? [];
  }, [role, roles, pathname]);
  const allowedRoleKey = allowedRoles.join("|");
  // Start false so server and first client render match (avoids hydration
  // mismatch); the optimistic hint is applied in the effect below, before
  // Firebase resolves, so post-login navigation still feels instant.
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    // Optimistically render when the freshly-stored login hint matches this
    // role. Full validation still runs below and redirects if anything is wrong.
    if (readRoleHint(allowedRoles)) setReady(true);

    if (!isFirebaseConfigured) {
      router.replace("/login");
      return;
    }

    const validateUser = async (user: typeof auth.currentUser) => {
      if (!user) {
        clearRoleHint();
        router.replace("/login");
        return;
      }

      const claims = await refreshClaims(user);
      const claimRole = claims?.role;
      let actualRole = isValidRole(claimRole) ? claimRole : undefined;
      let userData: { role?: unknown; status?: string } | undefined;

      try {
        const userSnapshot = await getDoc(doc(db, "users", user.uid));
        userData = userSnapshot.exists() ? (userSnapshot.data() as { role?: unknown; status?: string }) : undefined;
        if (isValidRole(userData?.role)) actualRole = userData.role;
      } catch {
        // Keep the refreshed token role if the profile lookup is temporarily unavailable.
      }

      if (!actualRole || !allowedRoles.includes(actualRole)) {
        // The cached hint pointed at a portal this user can't access — drop it
        // so it can't optimistically render the wrong portal again.
        clearRoleHint();
        router.replace("/unauthorized");
        return;
      }

      // Keep the hint in sync with the freshly-validated role.
      writeRoleHint(actualRole);

      if (actualRole === "teacher") {
        if (userData?.status !== "active") {
          await signOut(auth);
          router.replace("/login?reason=inactive");
          return;
        }
      }

      if (!cancelled) setReady(true);
    };

    if (auth.currentUser) {
      void validateUser(auth.currentUser);
      return () => {
        cancelled = true;
      };
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      void validateUser(user);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [allowedRoleKey, allowedRoles, router]);

  if (!ready) {
    return <BrandLoader message="Loading secure workspace…" />;
  }

  return children;
}
