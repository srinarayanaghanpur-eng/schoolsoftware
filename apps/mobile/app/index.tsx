/**
 * Entry route — the app's single authentication + role redirect guard.
 * (The old app had three competing redirect guards; this is the only one.)
 */
import React from "react";
import { Redirect } from "expo-router";
import { LoadingState } from "@/design-system/components";
import { useMobileSession } from "@/lib/mobileSession";
import { dashboardPathForRole } from "@/lib/roleRouting";

export default function Index() {
  const session = useMobileSession();

  if (session.status === "checking") {
    return <LoadingState label="Opening workspace…" />;
  }
  if (session.status === "authenticated" && session.profile) {
    return <Redirect href={dashboardPathForRole(session.profile.role) as never} />;
  }
  return <Redirect href={"/login" as never} />;
}
