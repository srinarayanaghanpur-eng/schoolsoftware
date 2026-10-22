import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { StaffDetailScreen } from "@/features/admin/featureScreens";

export default function AdminStaffDetailRoute() {
  return (
    <AdminShell>
      <StaffDetailScreen />
    </AdminShell>
  );
}
