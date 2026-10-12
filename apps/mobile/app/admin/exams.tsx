import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { ExamsScreen } from "@/features/admin/screens";

export default function AdminExamsRoute() {
  return (
    <AdminShell>
      <ExamsScreen />
    </AdminShell>
  );
}
