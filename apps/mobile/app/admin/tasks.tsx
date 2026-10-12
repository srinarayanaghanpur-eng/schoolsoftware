import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { TaskAssignScreen } from "@/features/admin/screens";

export default function AdminTasksRoute() {
  return (
    <AdminShell>
      <TaskAssignScreen />
    </AdminShell>
  );
}
