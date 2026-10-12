import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { NoticesScreen } from "../admin/notices";

export default function AccountantNoticesRoute() {
  return (
    <AccountantShell>
      <NoticesScreen />
    </AccountantShell>
  );
}
