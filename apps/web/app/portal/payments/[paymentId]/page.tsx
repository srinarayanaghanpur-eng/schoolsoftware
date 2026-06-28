"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES } from "@sri-narayana/shared";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

type ReceiptData = {
  receiptNo: string;
  paymentId: string;
  schoolName: string;
  schoolAddress: string;
  date: string;
  student: {
    id: string;
    name: string;
    admissionNo: string;
    className: string;
    section: string;
    fatherName: string;
  } | null;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  transactionId: string;
  status: string;
};

function ReceiptView() {
  const params = useParams();
  const paymentId = params.paymentId as string;
  const printRef = useRef<HTMLDivElement>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    adminApiRequest<{ ok: true; receipt: ReceiptData }>(`/api/portal/payments/${encodeURIComponent(paymentId)}/receipt`)
      .then((result) => setReceipt(result.receipt))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load receipt."))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <section className="p-4 md:p-7">
        <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading receipt...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="p-4 md:p-7">
        <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>
        <Link href="/portal/payments" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[#3033a1] hover:underline">
          <ArrowLeft size={16} /> Back to payments
        </Link>
      </section>
    );
  }

  if (!receipt) return null;

  return (
    <section className="p-4 md:p-7">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/portal/payments" className="inline-flex items-center gap-2 text-sm font-bold text-[#3033a1] hover:underline">
          <ArrowLeft size={16} /> Back to payments
        </Link>
        <button onClick={handlePrint} className="btn-primary text-sm">
          <Printer size={16} /> Print Receipt
        </button>
      </div>

      <div
        ref={printRef}
        className="mx-auto max-w-[600px] overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white shadow-[0_2px_12px_rgba(36,42,94,0.06)] print:shadow-none print:border-0"
      >
        <div className="border-b border-[#edf0f7] bg-[#f7f8fd] p-6 text-center">
          <h1 className="text-xl font-extrabold text-[#1b1d32]">{receipt.schoolName}</h1>
          {receipt.schoolAddress && <p className="mt-1 text-sm text-[#7d86a8]">{receipt.schoolAddress}</p>}
          <p className="mt-3 text-lg font-bold text-[#3033a1]">Fee Receipt</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-[#7d86a8]">Receipt No.</span>
            <span className="font-bold text-[#1b1d32]">{receipt.receiptNo}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-[#7d86a8]">Date</span>
            <span className="font-bold text-[#1b1d32]">{receipt.date}</span>
          </div>

          <hr className="border-[#edf0f7]" />

          {receipt.student && (
            <>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-[#7d86a8]">Student Name</span>
                <span className="font-bold text-[#1b1d32]">{receipt.student.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-[#7d86a8]">Admission No.</span>
                <span className="font-bold text-[#1b1d32]">{receipt.student.admissionNo || "--"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-[#7d86a8]">Class & Section</span>
                <span className="font-bold text-[#1b1d32]">{receipt.student.className}{receipt.student.section ? ` - ${receipt.student.section}` : ""}</span>
              </div>
              {receipt.student.fatherName && (
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-[#7d86a8]">Father Name</span>
                  <span className="font-bold text-[#1b1d32]">{receipt.student.fatherName}</span>
                </div>
              )}
            </>
          )}

          <hr className="border-[#edf0f7]" />

          <div className="flex justify-between text-sm">
            <span className="font-semibold text-[#7d86a8]">Payment Type</span>
            <span className="font-bold text-[#1b1d32] capitalize">{receipt.paymentType.replace(/-/g, " ")}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-[#7d86a8]">Payment Method</span>
            <span className="font-bold text-[#1b1d32] capitalize">{receipt.paymentMethod}</span>
          </div>
          {receipt.transactionId && (
            <div className="flex justify-between text-sm">
              <span className="font-semibold text-[#7d86a8]">Transaction ID</span>
              <span className="font-bold text-[#1b1d32] font-mono text-xs">{receipt.transactionId}</span>
            </div>
          )}

          <hr className="border-[#edf0f7]" />

          <div className="flex justify-between items-center">
            <span className="text-base font-bold text-[#1b1d32]">Total Paid</span>
            <span className="text-2xl font-extrabold text-[#13a961]">{formatINR(receipt.amount)}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="font-semibold text-[#7d86a8]">Status</span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
              receipt.status === "completed" ? "bg-[#e6f8ef] text-[#0f8d52]" :
              "bg-[#fff4df] text-[#b87d0e]"
            }`}>
              {receipt.status}
            </span>
          </div>
        </div>

        <div className="border-t border-[#edf0f7] p-4 text-center text-xs text-[#7d86a8]">
          This is a computer-generated receipt.
        </div>
      </div>
    </section>
  );
}

export default function PortalReceiptPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <ReceiptView />
      </AppShell>
    </AuthGate>
  );
}
