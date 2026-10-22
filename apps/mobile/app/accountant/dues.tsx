import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { DuesListScreen } from "@/features/admin/featureScreens";

export default function AccountantDuesRoute() {
  return (
    <AccountantShell>
      <DuesListScreen />
    </AccountantShell>
  );
}
