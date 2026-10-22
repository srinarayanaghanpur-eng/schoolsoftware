import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { StaffDetailScreen } from "@/features/admin/featureScreens";

export default function PrincipalStaffDetailRoute() {
  return (
    <PrincipalShell>
      <StaffDetailScreen />
    </PrincipalShell>
  );
}
