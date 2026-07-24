import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { StaffScreen } from "@/features/admin/screens";

export default function PrincipalStaffRoute() {
  return (
    <PrincipalShell>
      <StaffScreen />
    </PrincipalShell>
  );
}
