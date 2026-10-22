import React from "react";
import { AccountantShell } from "@/features/admin/shell";
import { ReceiptDetailScreen } from "@/features/admin/featureScreens";

export default function AccountantReceiptRoute() {
  return (
    <AccountantShell>
      <ReceiptDetailScreen />
    </AccountantShell>
  );
}
