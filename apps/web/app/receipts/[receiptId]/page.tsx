"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ReceiptPreviewClient } from "@/components/receipts/ReceiptPreviewClient";
import { ROLES } from "@sri-narayana/shared";
import { useParams } from "next/navigation";

export default function ReceiptPage() {
  const params = useParams();
  const receiptId = params?.receiptId as string;
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <ReceiptPreviewClient receiptId={receiptId} backHref="/admin/payments" backLabel="Back to Fee Collection" />
      </AppShell>
    </AuthGate>
  );
}
