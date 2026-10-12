import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { ExpensesScreen } from "@/features/admin/screens";

export default function PrincipalExpensesRoute() {
  return (
    <PrincipalShell>
      <ExpensesScreen />
    </PrincipalShell>
  );
}
