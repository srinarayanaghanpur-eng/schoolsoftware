"use client";

import { useParams } from "next/navigation";
import { ReceiptPreviewClient } from "@/components/receipts/ReceiptPreviewClient";

export default function AdminFinanceReceiptPage() {
  const params = useParams();
  const paymentId = params?.paymentId as string;
  return (
    <ReceiptPreviewClient
      receiptId={paymentId}
      backHref="/admin/payments"
      backLabel="Back to Fee Collection"
    />
  );
}
