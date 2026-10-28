import React from "react";
import { ThemedStack } from "@/lib/ThemedStack";
import { WorkspaceGuard } from "@/lib/WorkspaceGuard";
import type { Role } from "@sri-narayana/shared";

const ALLOWED: Role[] = ["principal"];

export default function PrincipalLayout() {
  return (
    <WorkspaceGuard allowed={ALLOWED}>
      <ThemedStack animation="fade" />
    </WorkspaceGuard>
  );
}
