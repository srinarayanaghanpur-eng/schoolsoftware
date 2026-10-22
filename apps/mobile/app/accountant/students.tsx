import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { StudentSearchScreen } from "@/features/admin/featureScreens";

export default function AccountantStudentsRoute() {
  return (
    <AccountantShell>
      <StudentSearchScreen />
    </AccountantShell>
  );
}
