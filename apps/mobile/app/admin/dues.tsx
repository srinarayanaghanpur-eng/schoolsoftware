import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { DuesListScreen } from "@/features/admin/featureScreens";

export default function AdminDuesRoute() {
  return (
    <AdminShell>
      <DuesListScreen />
    </AdminShell>
  );
}
