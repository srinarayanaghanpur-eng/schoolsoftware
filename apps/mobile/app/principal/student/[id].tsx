import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { StudentDetailScreen } from "@/features/admin/featureScreens";

export default function PrincipalStudentRoute() {
  return (
    <PrincipalShell>
      <StudentDetailScreen />
    </PrincipalShell>
  );
}
