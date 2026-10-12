import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { ExpensesScreen } from "@/features/admin/screens";

export default function AdminExpensesRoute() {
  return (
    <AdminShell>
      <ExpensesScreen />
    </AdminShell>
  );
}
