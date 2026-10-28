import React from "react";
import { ThemedStack } from "@/lib/ThemedStack";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["admin", "super_admin"];

export default function AdminLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <ThemedStack animation="fade" />
    </WorkspaceGuard>
  );
}
