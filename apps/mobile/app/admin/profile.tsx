import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { ManagementProfileScreen } from "@/features/admin/screens";

export default function AdminProfileRoute() {
  return (
    <AdminShell>
      <ManagementProfileScreen />
    </AdminShell>
  );
}
