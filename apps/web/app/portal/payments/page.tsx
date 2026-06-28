"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES } from "@sri-narayana/shared";
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

type LinkedStudent = { id: string; name: string; className: string };

function PaymentHistory() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = async (studentId = "") => {
    setLoading(true);
    setError(null);
    try {
      const params = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
      const result = await adminApiRequest<{ ok: true; payments: PaymentRecord[]; linkedStudentIds: string[]; linkedStudents: LinkedStudent[] }>(`/api/portal/payments${params}`);
      setPayments(result.payments);
      setLinkedStudents(result.linkedStudents);
      if (result.linkedStudents.length > 0 && !studentId) {
        setSelectedStudentId(result.linkedStudents[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payment history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPayments("");
  }, []);

  return (
    <>
      <PageHeader
        title="Payment History"
        description={linkedStudents.length > 1 ? "Select a student to view their payment history" : (linkedStudents[0] ? `${linkedStudents[0].name} · Class ${linkedStudents[0].className}` : undefined)}
        action={
          linkedStudents.length > 1 ? (
            <select
              className="field min-w-[220px]"
              value={selectedStudentId}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                void loadPayments(event.target.value);
              }}
            >
              {linkedStudents.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · Class {s.className}</option>
              ))}
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
                  <th className="px-4 py-3">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pmt) => {
                  const date = pmt.createdAt ? new Date(pmt.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "--";
                  return (
                    <tr key={pmt.id} className="border-t border-[#edf0f7]">
                      <td className="px-4 py-3 font-semibold text-[#303247] whitespace-nowrap">{date}</td>
                      <td className="px-4 py-3 text-[#7d86a8] font-mono text-xs">{pmt.receiptNumber || pmt.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-[#7d86a8] capitalize">{pmt.paymentType.replace(/-/g, " ")}</td>
                      <td className="px-4 py-3 text-[#7d86a8] capitalize">{pmt.paymentMethod}</td>
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
                          <Download size={13} />
                          View
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
