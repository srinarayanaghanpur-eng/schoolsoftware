import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { WorkspaceProfileScreen } from "../admin/profile";

export default function PrincipalProfileRoute() {
  return (
    <PrincipalShell>
      <WorkspaceProfileScreen />
    </PrincipalShell>
  );
}
