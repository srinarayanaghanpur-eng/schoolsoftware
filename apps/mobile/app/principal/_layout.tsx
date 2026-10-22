import React from "react";
import { Stack } from "expo-router";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["principal"];

export default function PrincipalLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </WorkspaceGuard>
  );
}
