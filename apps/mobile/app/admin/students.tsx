import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { StudentSearchScreen } from "@/features/admin/featureScreens";

export default function AdminStudentsRoute() {
  return (
    <AdminShell>
      <StudentSearchScreen />
    </AdminShell>
  );
}
