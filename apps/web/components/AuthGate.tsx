"use client";

import { isValidRole, type UserRole } from "@sri-narayana/shared";
import { useAuth } from "@/components/AuthProvider";
import { consumeLogoutRedirect } from "@/lib/authStorage";
import { rolesForPath } from "@/lib/routeAccess";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import AppLoader from "./AppLoader";
import { AutoLogoutProvider } from "./auth/AutoLogoutProvider";

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
  const router = useRouter();
  const { status, role: actualRole } = useAuth();
  const redirectRef = useRef<string | null>(null);

  useEffect(() => {
    redirectRef.current = null;
  }, [pathname]);

  useEffect(() => {
    if (status === "checking") return;

    const redirectOnce = (href: string) => {
      if (redirectRef.current === href) return;
      redirectRef.current = href;
      router.replace(href);
    };

    if (status === "unauthenticated") {
      redirectOnce(consumeLogoutRedirect() ? "/login?loggedOut=1" : "/login");
      return;
    }

    if (status === "error") {
      redirectOnce("/login?reason=auth-error");
      return;
    }

    if (allowedRoles.length > 0 && (!isValidRole(actualRole) || !allowedRoles.includes(actualRole))) {
      redirectOnce("/unauthorized");
    }
  }, [actualRole, allowedRoles, router, status]);

  if (
    status === "checking" ||
    status === "unauthenticated" ||
    status === "error" ||
    (allowedRoles.length > 0 && (!isValidRole(actualRole) || !allowedRoles.includes(actualRole)))
  ) {
    return <AppLoader message="Checking your session…" />;
  }

  return <AutoLogoutProvider>{children}</AutoLogoutProvider>;
}
