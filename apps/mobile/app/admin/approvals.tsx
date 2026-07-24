import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { ApprovalsScreen } from "@/features/admin/screens";

export default function AdminApprovalsRoute() {
  return (
    <AdminShell>
      <ApprovalsScreen />
    </AdminShell>
  );
}
