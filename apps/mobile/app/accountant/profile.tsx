import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { ManagementProfileScreen } from "@/features/admin/screens";

export default function AccountantProfileRoute() {
  return (
    <AccountantShell>
      <ManagementProfileScreen />
    </AccountantShell>
  );
}
