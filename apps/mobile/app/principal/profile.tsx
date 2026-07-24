import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { ManagementProfileScreen } from "@/features/admin/screens";

export default function PrincipalProfileRoute() {
  return (
    <PrincipalShell>
      <ManagementProfileScreen />
    </PrincipalShell>
  );
}
