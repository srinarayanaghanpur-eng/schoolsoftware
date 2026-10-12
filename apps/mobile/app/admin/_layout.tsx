import React from "react";
import { Stack } from "expo-router";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["admin", "super_admin"];

export default function AdminLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </WorkspaceGuard>
  );
}
