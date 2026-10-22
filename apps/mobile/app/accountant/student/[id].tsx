import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { StudentDetailScreen } from "@/features/admin/featureScreens";

export default function AccountantStudentRoute() {
  return (
    <AccountantShell>
      <StudentDetailScreen />
    </AccountantShell>
  );
}
