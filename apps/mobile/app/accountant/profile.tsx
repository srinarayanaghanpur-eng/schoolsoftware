import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { WorkspaceProfileScreen } from "../admin/profile";

export default function AccountantProfileRoute() {
  return (
    <AccountantShell>
      <WorkspaceProfileScreen />
    </AccountantShell>
  );
}
