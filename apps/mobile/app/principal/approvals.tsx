import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { ApprovalsScreen } from "@/features/admin/screens";

export default function PrincipalApprovalsRoute() {
  return (
    <PrincipalShell>
      <ApprovalsScreen />
    </PrincipalShell>
  );
}
