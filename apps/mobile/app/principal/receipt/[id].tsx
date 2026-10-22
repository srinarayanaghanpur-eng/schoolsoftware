import React from "react";
import { PrincipalShell } from "@/features/admin/shell";
import { ReceiptDetailScreen } from "@/features/admin/featureScreens";

export default function PrincipalReceiptRoute() {
  return (
    <PrincipalShell>
      <ReceiptDetailScreen />
    </PrincipalShell>
  );
}
