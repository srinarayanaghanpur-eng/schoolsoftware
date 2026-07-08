"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES, formatLabel } from "@sri-narayana/shared";
import { Download, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

type PaymentRecord = {
  id: string;
  amountPaid: number;
  paymentType: string;
  paymentMethod: string;
  transactionId: string;
  status: string;
  receiptNumber: string;
  createdAt: string;
};

function PaymentHistory() {
  const { selectedChildId, selectedChild, children, switchChild, loading: childrenLoading } = usePortalChild();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: true; payments: PaymentRecord[] }>(`/api/portal/payments?studentId=${encodeURIComponent(studentId)}`);
      setPayments(result.payments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChildId) void loadPayments(selectedChildId);
  }, [selectedChildId]);

  if (childrenLoading) {
    return <section className="p-4 md:p-7"><div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading...</div></section>;
  }

  return (
    <>
      <PageHeader
        title="Payment History"
        description={selectedChild ? `${selectedChild.name} · Class ${selectedChild.className}` : "View payment history"}
        action={
          children.length > 1 ? (
            <select className="field min-w-[220px]" value={selectedChildId} onChange={(e) => { switchChild(e.target.value); }}>
              {children.map((s) => <option key={s.id} value={s.id}>{s.name} · Class {s.className}</option>)}
            </select>
          ) : null
        }
      />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}

        {loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading payment history...</div>
        ) : payments.length === 0 ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">
            <ReceiptText className="mx-auto mb-3 text-[#3033a1]" size={32} />
            No payments recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
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
                {payments.map((pmt) => {
                  const date = pmt.createdAt ? new Date(pmt.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "--";
                  return (
                    <tr key={pmt.id} className="border-t border-[#edf0f7]">
                      <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#303247]">{date}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#7d86a8]">{pmt.receiptNumber || pmt.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-[#7d86a8]">{formatLabel(pmt.paymentType)}</td>
                      <td className="px-4 py-3 text-[#7d86a8]">{formatLabel(pmt.paymentMethod)}</td>
                      <td className="px-4 py-3 font-bold text-[#303247]">{formatINR(pmt.amountPaid)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          pmt.status === "completed" ? "bg-[#e6f8ef] text-[#0f8d52]" :
                          pmt.status === "cancelled" ? "bg-[#ffebed] text-[#c83f4d]" :
                          "bg-[#fff4df] text-[#b87d0e]"
                        }`}>
                          {pmt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/portal/payments/${pmt.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#eef0ff] px-3 py-1.5 text-xs font-bold text-[#3033a1] transition hover:bg-[#dde0ff]"
                        >
                          <Download size={13} /> View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function PortalPaymentsPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <PaymentHistory />
      </AppShell>
    </AuthGate>
  );
}
