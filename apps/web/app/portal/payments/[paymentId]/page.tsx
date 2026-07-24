"use client";

import { AppShell } from "@/components/AppShell";
import { ReceiptPreviewClient } from "@/components/receipts/ReceiptPreviewClient";
import { useParams } from "next/navigation";

export default function PortalReceiptPage() {
  const params = useParams();
  const paymentId = params.paymentId as string;
  return (
    <AppShell>
      <ReceiptPreviewClient
        receiptId={paymentId}
        backHref="/portal/payments"
        backLabel="Back to Payments"
        showShareActions={false}
      />
    </AppShell>
  );
}
