"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { PortalChildProvider, usePortalChild } from "@/components/PortalChildContext";
import { UpiQr, DEFAULT_UPI_ID, DEFAULT_UPI_PAYEE_NAME } from "@/components/UpiQr";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES } from "@sri-narayana/shared";
import { CreditCard, Download, ReceiptText, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

type FeeSummary = {
  student: { id: string; name: string; className: string; section?: string; admissionNo?: string };
  fees: { total: number; paid: number; due: number; status?: string; feeBalanceCarriedForward?: number };
  recentPayments?: { id: string; amountPaid: number; paymentType: string; paymentMethod: string; receiptNumber: string; createdAt: string; status: string }[];
  installmentPlan?: { totalAmount: number; installments: { number: number; amount: number; dueDate: string; status: string; paidDate?: string }[] };
};

function FeeManagement() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [data, setData] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<{ receiptId: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpi, setShowUpi] = useState(false);

  const loadData = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: true; summary: FeeSummary }>(`/api/portal/summary?studentId=${encodeURIComponent(studentId)}`);
      setData(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load fee data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChildId) void loadData(selectedChildId);
  }, [selectedChildId]);

  const payNow = async () => {
    if (!data || data.fees.due <= 0) return;
    setPaying(true);
    setError(null);
    setReceipt(null);
    try {
      const order = await adminApiRequest<{ ok: true; orderId: string; amount: number }>("/api/fees/order", {
        method: "POST",
        body: JSON.stringify({ studentId: data.student.id, amount: data.fees.due, paymentType: "portal-fee", note: "Portal fee payment" }),
      });
      const confirmation = await adminApiRequest<{ ok: true; receiptId: string; amount: number }>("/api/fees/confirm", {
        method: "POST",
        body: JSON.stringify({ orderId: order.orderId, transactionId: `FEE-${Date.now()}`, method: "online" }),
      });
      setReceipt({ receiptId: confirmation.receiptId, amount: confirmation.amount });
      await loadData(data.student.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete payment.");
    } finally {
      setPaying(false);
    }
  };

  if (childrenLoading) {
    return <section className="p-4 md:p-7"><div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading...</div></section>;
  }

  return (
    <>
      <PageHeader
        title="Fee Management"
        description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : "Manage fees"}
        action={
          children.length > 1 ? (
            <select className="field min-w-[220px]" value={selectedChildId} onChange={(e) => switchChild(e.target.value)}>
              {children.map((s) => <option key={s.id} value={s.id}>{s.name} · Class {s.className}</option>)}
            </select>
          ) : null
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        {receipt && (
          <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">
            Payment successful! Receipt: <Link href={`/portal/payments/${receipt.receiptId}`} className="underline">{receipt.receiptId}</Link> for {formatINR(receipt.amount)}.
          </div>
        )}

        {loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading fee details...</div>
        ) : data ? (
          <>
            <div className="stagger-children grid gap-4 sm:grid-cols-3">
              <div className="card p-5">
                <p className="text-sm font-semibold text-[#7d86a8]">Total Fees</p>
                <p className="mt-3 text-[30px] font-extrabold leading-none text-[#1b1d32]">{formatINR(data.fees.total)}</p>
              </div>
              <div className="card p-5">
                <p className="text-sm font-semibold text-[#7d86a8]">Paid</p>
                <p className="mt-3 text-[30px] font-extrabold leading-none text-[#13a961]">{formatINR(data.fees.paid)}</p>
              </div>
              <div className="card p-5">
                <p className="text-sm font-semibold text-[#7d86a8]">Pending</p>
                <p className="mt-3 text-[30px] font-extrabold leading-none text-[#ed515d]">{formatINR(data.fees.due)}</p>
              </div>
            </div>

            {data.fees.feeBalanceCarriedForward ? (
              <div className="rounded-2xl border border-[#fff4df] bg-[#fffcf0] px-5 py-4">
                <div className="flex items-center gap-3">
                  <TriangleAlert size={20} className="text-[#b87d0e]" />
                  <p className="text-sm font-bold text-[#7d5d0a]">
                    Previous year balance carried forward: {formatINR(data.fees.feeBalanceCarriedForward)}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-extrabold text-[#1f2136]">Make Payment</h2>
                  <p className="mt-1 text-sm font-medium text-[#7d86a8]">Pay outstanding fees online via card, UPI, or net banking.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary" onClick={() => void payNow()} disabled={paying || data.fees.due <= 0}>
                    <CreditCard size={16} /> {paying ? "Processing..." : data.fees.due > 0 ? `Pay ${formatINR(data.fees.due)}` : "No dues"}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowUpi(!showUpi)}>
                    {showUpi ? "Hide QR" : "Scan & Pay (UPI)"}
                  </button>
                </div>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#eef0f7]">
                <div className="h-full rounded-full bg-[#3033a1]" style={{ width: `${data.fees.total > 0 ? Math.min(100, Math.round((data.fees.paid / data.fees.total) * 100)) : 0}%` }} />
              </div>
              <div className="mt-3 flex justify-between text-xs font-medium text-[#7d86a8]">
                <span>{formatINR(data.fees.paid)} paid</span>
                <span>{formatINR(data.fees.due)} remaining</span>
              </div>
            </div>

            {showUpi && (
              <div className="card p-5">
                <h3 className="mb-4 font-extrabold text-[#1f2136]">Scan with any UPI App</h3>
                <UpiQr upiId={DEFAULT_UPI_ID} payeeName={DEFAULT_UPI_PAYEE_NAME} amount={data.fees.due || undefined} note={`Fee payment for ${data.student.name}`} size={220} />
              </div>
            )}

            {data.recentPayments && data.recentPayments.length > 0 && (
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-[#edf0f7] px-5 py-4">
                  <ReceiptText size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Payment History</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="bg-[#f7f8fd] text-xs uppercase text-[#6f7898]">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Receipt</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Method</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recentPayments.map((pmt) => {
                        const date = pmt.createdAt ? new Date(pmt.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "--";
                        return (
                          <tr key={pmt.id} className="border-t border-[#edf0f7]">
                            <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#303247]">{date}</td>
                            <td className="px-4 py-3 font-mono text-xs text-[#7d86a8]">{pmt.receiptNumber || pmt.id.slice(0, 8)}</td>
                            <td className="px-4 py-3 capitalize text-[#7d86a8]">{pmt.paymentType.replace(/-/g, " ")}</td>
                            <td className="px-4 py-3 capitalize text-[#7d86a8]">{pmt.paymentMethod}</td>
                            <td className="px-4 py-3 font-bold text-[#303247]">{formatINR(pmt.amountPaid)}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                pmt.status === "completed" ? "bg-[#e6f8ef] text-[#0f8d52]" :
                                pmt.status === "cancelled" ? "bg-[#ffebed] text-[#c83f4d]" :
                                "bg-[#fff4df] text-[#b87d0e]"
                              }`}>{pmt.status}</span>
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/portal/payments/${pmt.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#eef0ff] px-3 py-1.5 text-xs font-bold text-[#3033a1] transition hover:bg-[#dde0ff]">
                                <Download size={13} /> Receipt
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!data.recentPayments || data.recentPayments.length === 0) && (
              <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">
                <ReceiptText className="mx-auto mb-3 text-[#3033a1]" size={32} />
                No payment history yet.
              </div>
            )}
          </>
        ) : null}
      </section>
    </>
  );
}

export default function PortalFeesPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <FeeManagement />
      </AppShell>
    </AuthGate>
  );
}
