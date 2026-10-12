import React from "react";
import { Stack } from "expo-router";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["accountant"];

export default function AccountantLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </WorkspaceGuard>
  );
}
