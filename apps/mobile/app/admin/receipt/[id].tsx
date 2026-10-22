import React from "react";
import { AdminShell } from "@/features/admin/shell";
import { ReceiptDetailScreen } from "@/features/admin/featureScreens";

export default function AdminReceiptRoute() {
  return (
    <AdminShell>
      <ReceiptDetailScreen />
    </AdminShell>
  );
}
