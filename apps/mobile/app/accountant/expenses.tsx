import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { ExpensesScreen } from "@/features/admin/screens";

export default function AccountantExpensesRoute() {
  return (
    <AccountantShell>
      <ExpensesScreen />
    </AccountantShell>
  );
}
