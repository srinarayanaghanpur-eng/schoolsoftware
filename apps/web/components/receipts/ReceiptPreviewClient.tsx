"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clipboard, Download, MessageCircle, Printer, Send } from "lucide-react";
import type { DigitalFeeReceiptRecord } from "@/lib/receiptService";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ReceiptA4Page } from "./ReceiptA4Page";

function formatINR(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value: string) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString("en-GB");
}

function parentMobileForLink(value: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const tenDigit = digits.length > 10 ? digits.slice(-10) : digits;
  return tenDigit.length === 10 ? `91${tenDigit}` : tenDigit;
}

function buildParentMessage(receipt: DigitalFeeReceiptRecord) {
  return [
    "Dear Parent,",
    `Fee payment received for ${receipt.studentName || "student"}.`,
    "",
    `Receipt No: ${receipt.receiptNo}`,
    `Amount Paid: ₹${formatINR(receipt.totalPaid)}`,
    `Balance Due: ₹${formatINR(receipt.balanceDue)}`,
    `Date: ${formatDate(receipt.paymentDate)}`,
    "",
    "Sri Narayana High School"
  ].join("\n");
}

export function ReceiptPreviewClient({
  receiptId,
  autoPrint = false,
  printOnly = false,
  showShareActions = true,
  backHref = "/admin/payments",
  backLabel = "Back to Fee Collection"
}: {
  receiptId: string;
  autoPrint?: boolean;
  printOnly?: boolean;
  showShareActions?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const [receipt, setReceipt] = useState<DigitalFeeReceiptRecord | null>(null);
  const [canPrint, setCanPrint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);

  useEffect(() => {
    if (!receiptId) return;
    setLoading(true);
    setError(null);
    adminApiRequest<{ ok: true; receipt: DigitalFeeReceiptRecord; canPrint?: boolean }>(`/api/receipts/${encodeURIComponent(receiptId)}`, undefined, { fresh: true })
      .then((result) => {
        setReceipt(result.receipt);
        setCanPrint(Boolean(result.canPrint));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load receipt."))
      .finally(() => setLoading(false));
  }, [receiptId]);

  const message = useMemo(() => receipt ? buildParentMessage(receipt) : "", [receipt]);
  const mobile = useMemo(() => receipt ? parentMobileForLink(receipt.mobile) : "", [receipt]);
  const whatsappUrl = mobile && message ? `https://wa.me/${mobile}?text=${encodeURIComponent(message)}` : "";
  const smsUrl = mobile && message ? `sms:${mobile}?body=${encodeURIComponent(message)}` : "";

  const markPrinted = useCallback(async () => {
    if (!receipt || !canPrint) return receipt;
    const result = await adminApiRequest<{ ok: true; receipt: DigitalFeeReceiptRecord }>(
      `/api/receipts/${encodeURIComponent(receipt.id)}`,
      { method: "PATCH", body: JSON.stringify({ action: "markPrinted" }) }
    );
    setReceipt(result.receipt);
    return result.receipt;
  }, [canPrint, receipt]);

  const handlePrint = useCallback(async () => {
    if (!canPrint) return;
    await markPrinted().catch(() => undefined);
    window.print();
  }, [canPrint, markPrinted]);

  useEffect(() => {
    if (!autoPrint || hasAutoPrinted || !receipt || !canPrint) return;
    setHasAutoPrinted(true);
    setTimeout(() => {
      handlePrint();
    }, 250);
  }, [autoPrint, canPrint, handlePrint, hasAutoPrinted, receipt]);

  const copySmsText = async () => {
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fd]">
        <div className="text-sm font-semibold text-[#7d86a8]">Loading receipt...</div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f7fd] p-4">
        <div className="card max-w-md p-8 text-center">
          <p className="text-sm font-semibold text-[#ed515d]">{error || "Receipt not found"}</p>
          <Link href={backHref} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#3033a1] hover:underline">
            <ArrowLeft size={16} /> {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={printOnly ? "min-h-screen bg-white" : "min-h-screen bg-[#f5f7fd] print:bg-white"}>
      {!printOnly && (
        <div className="no-print mx-auto flex max-w-[960px] flex-wrap items-center justify-between gap-3 px-4 py-5">
          <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-bold text-[#3033a1] hover:underline">
            <ArrowLeft size={16} /> {backLabel}
          </Link>
          <div className="flex flex-wrap gap-2">
            {canPrint && (
              <>
                <button onClick={handlePrint} className="btn-primary text-sm">
                  <Printer size={16} /> Print Receipt
                </button>
                <button onClick={handlePrint} className="btn-secondary text-sm">
                  <Download size={16} /> Download PDF
                </button>
              </>
            )}
            {showShareActions && whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
                <MessageCircle size={16} /> Send via WhatsApp
              </a>
            )}
            {showShareActions && smsUrl && (
              <a href={smsUrl} className="btn-secondary text-sm">
                <Send size={16} /> Send SMS
              </a>
            )}
            {showShareActions && (
              <button type="button" onClick={copySmsText} className="btn-secondary text-sm">
                <Clipboard size={16} /> {copied ? "Copied" : "Copy SMS Text"}
              </button>
            )}
          </div>
        </div>
      )}
      <ReceiptA4Page receipt={receipt} />
    </div>
  );
}
