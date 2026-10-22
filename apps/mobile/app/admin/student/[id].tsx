import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { StudentDetailScreen } from "@/features/admin/featureScreens";

export default function AdminStudentRoute() {
  return (
    <AdminShell>
      <StudentDetailScreen />
    </AdminShell>
  );
}
