import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { StaffScreen } from "@/features/admin/screens";

export default function AdminStaffRoute() {
  return (
    <AdminShell>
      <StaffScreen />
    </AdminShell>
  );
}
