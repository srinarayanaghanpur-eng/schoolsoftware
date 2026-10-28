import React from "react";
import { ThemedStack } from "@/lib/ThemedStack";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["accountant"];

export default function AccountantLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <ThemedStack animation="fade" />
    </WorkspaceGuard>
  );
}
