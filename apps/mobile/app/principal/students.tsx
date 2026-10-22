import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { StudentSearchScreen } from "@/features/admin/featureScreens";

export default function PrincipalStudentsRoute() {
  return (
    <PrincipalShell>
      <StudentSearchScreen />
    </PrincipalShell>
  );
}
