"use client";

import { AuthGate } from "@/components/AuthGate";
import { ReceiptPreviewClient } from "@/components/receipts/ReceiptPreviewClient";
import { ROLES } from "@sri-narayana/shared";
import { useParams } from "next/navigation";

export default function ReceiptPrintPage() {
  const params = useParams();
  const receiptId = params?.receiptId as string;
  return (
    <AuthGate roles={ROLES}>
      <ReceiptPreviewClient receiptId={receiptId} autoPrint printOnly />
    </AuthGate>
  );
}
