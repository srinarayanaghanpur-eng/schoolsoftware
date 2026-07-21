/**
 * Entry route — redirects by session state and role.
 * Role→path mapping is inlined so this file depends on neither the deleted
 * mobileTheme.ts nor the teardown-generated roleRouting.ts.
 */
import React from "react";
import { Redirect } from "expo-router";
import type { Role } from "@sri-narayana/shared";
import { LoadingState } from "@/design-system/components";
import { useMobileSession } from "@/lib/mobileSession";

function dashboardPathForRole(role?: Role): string {
  if (role === "parent") return "/parent";
  // Other workspaces are rebuilt in later phases; until then everyone
  // non-parent lands on the parent-style login guidance via /login.
  return "/login";
}

export default function Index() {
  const session = useMobileSession();

  if (session.status === "authenticated" && session.profile) {
    return <Redirect href={dashboardPathForRole(session.profile.role) as never} />;
  }
  if (session.status === "checking") {
    return <LoadingState label="Opening workspace…" />;
  }
  return <Redirect href={"/login" as never} />;
}
