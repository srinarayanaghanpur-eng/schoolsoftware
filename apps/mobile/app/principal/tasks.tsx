import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { TaskAssignScreen } from "@/features/admin/screens";

export default function PrincipalTasksRoute() {
  return (
    <PrincipalShell>
      <TaskAssignScreen />
    </PrincipalShell>
  );
}
