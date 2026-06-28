"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { PageHeader } from "@/components/PageHeader";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES, type PortalSummary } from "@sri-narayana/shared";
import { Award, BellRing, CreditCard, ExternalLink, Percent, ReceiptText } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

type LinkedStudent = { id: string; name: string; className: string };

function PortalDashboard() {
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<{ receiptId: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async (studentId = selectedStudentId) => {
    setLoading(true);
    setError(null);
    try {
      const params = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
      const result = await adminApiRequest<{ ok: true; summary: PortalSummary; linkedStudentIds: string[]; linkedStudents: LinkedStudent[] }>(`/api/portal/summary${params}`);
      setSummary(result.summary);
      setLinkedStudents(result.linkedStudents);
      setSelectedStudentId(result.summary.student.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load portal summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary("");
  }, []);

  const payNow = async () => {
    if (!summary || summary.fees.due <= 0) return;
    setPaying(true);
    setError(null);
    setReceipt(null);
    try {
      const order = await adminApiRequest<{ ok: true; orderId: string; amount: number }>("/api/fees/order", {
        method: "POST",
        body: JSON.stringify({
          studentId: summary.student.id,
          amount: summary.fees.due,
          paymentType: "portal-fee",
          note: "Portal pay now"
        })
      });
      const confirmation = await adminApiRequest<{ ok: true; receiptId: string; amount: number }>("/api/fees/confirm", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.orderId,
          transactionId: `PORTAL-${Date.now()}`,
          method: "online"
        })
      });
      setReceipt({ receiptId: confirmation.receiptId, amount: confirmation.amount });
      await loadSummary(summary.student.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete payment.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Portal"
        description={summary ? `${summary.student.name} · Class ${summary.student.className}${summary.student.section || ""}` : "Student and parent dashboard"}
        action={
          linkedStudents.length > 1 ? (
            <select
              className="field min-w-[220px]"
              value={selectedStudentId}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
                void loadSummary(event.target.value);
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
        {receipt && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">Receipt {receipt.receiptId} generated for {formatINR(receipt.amount)}.</div>}

        {loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading portal...</div>
        ) : summary ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card p-5">
                <p className="text-sm font-semibold text-[#7d86a8]">Total Fees</p>
                <p className="mt-3 text-[30px] font-extrabold leading-none text-[#1b1d32]">{formatINR(summary.fees.total)}</p>
              </div>
              <div className="card p-5">
                <p className="text-sm font-semibold text-[#7d86a8]">Paid</p>
                <p className="mt-3 text-[30px] font-extrabold leading-none text-[#13a961]">{formatINR(summary.fees.paid)}</p>
              </div>
              <div className="card p-5">
                <p className="text-sm font-semibold text-[#7d86a8]">Due</p>
                <p className="mt-3 text-[30px] font-extrabold leading-none text-[#ed515d]">{formatINR(summary.fees.due)}</p>
              </div>
              <div className="card p-5">
                <p className="text-sm font-semibold text-[#7d86a8]">Attendance</p>
                <p className="mt-3 text-[30px] font-extrabold leading-none text-[#3033a1]">{summary.attendancePercentage ?? 0}%</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="card p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-extrabold text-[#1f2136]">Fee Payment</h2>
                    <p className="mt-1 text-sm font-medium text-[#7d86a8]">Pay the current outstanding amount online.</p>
                  </div>
                  <button className="btn-primary" onClick={() => void payNow()} disabled={paying || summary.fees.due <= 0}>
                    <CreditCard size={16} /> {paying ? "Processing..." : summary.fees.due > 0 ? `Pay ${formatINR(summary.fees.due)}` : "No dues"}
                  </button>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#eef0f7]">
                  <div
                    className="h-full rounded-full bg-[#3033a1]"
                    style={{ width: `${summary.fees.total > 0 ? Math.min(100, Math.round((summary.fees.paid / summary.fees.total) * 100)) : 0}%` }}
                  />
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]"><Percent size={20} /></span>
                  <div>
                    <h2 className="font-extrabold text-[#1f2136]">Fee Status</h2>
                    <p className="text-sm font-semibold text-[#7d86a8]">{summary.fees.status ?? "pending"}</p>
                  </div>
                </div>
              </div>
            </div>

            {summary.recentPayments && summary.recentPayments.length > 0 && (
              <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ReceiptText size={20} className="text-[#3033a1]" />
                    <h2 className="font-extrabold text-[#1f2136]">Recent Payments</h2>
                  </div>
                  <Link href="/portal/payments" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#3033a1] hover:underline">
                    View all <ExternalLink size={14} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {summary.recentPayments.map((pmt) => (
                    <div key={pmt.id} className="flex items-center justify-between rounded-xl bg-[#f7f8fd] p-3">
                      <div>
                        <p className="text-sm font-bold text-[#303247]">{formatINR(pmt.amountPaid)}</p>
                        <p className="text-xs font-medium text-[#7d86a8]">{pmt.createdAt} · {pmt.paymentMethod}</p>
                      </div>
                      <Link
                        href={`/portal/payments/${pmt.id}`}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#3033a1] ring-1 ring-[#e3e6f0] transition hover:bg-[#eef0ff]"
                      >
                        Receipt
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-5 xl:grid-cols-2">
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-[#edf0f7] px-5 py-4">
                  <Award size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Published Marks</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-[#f7f8fd] text-xs uppercase text-[#6f7898]">
                      <tr>
                        <th className="px-4 py-3">Exam</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Marks</th>
                        <th className="px-4 py-3">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.marks.map((mark, index) => (
                        <tr key={`${mark.examName}-${mark.subject}-${index}`} className="border-t border-[#edf0f7]">
                          <td className="px-4 py-3 font-semibold text-[#303247]">{mark.examName}</td>
                          <td className="px-4 py-3 text-[#7d86a8]">{mark.subject}</td>
                          <td className="px-4 py-3 font-bold text-[#303247]">{mark.marksObtained}/{mark.maxMarks}</td>
                          <td className="px-4 py-3">{mark.grade || "--"}</td>
                        </tr>
                      ))}
                      {!summary.marks.length && (
                        <tr><td className="px-4 py-6 text-center text-sm font-medium text-[#7d86a8]" colSpan={4}>No published marks yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <BellRing size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Notices</h2>
                </div>
                <div className="space-y-3">
                  {summary.notices.map((notice, index) => (
                    <div key={`${notice.title}-${index}`} className="rounded-xl bg-[#f7f8fd] p-4">
                      <p className="font-bold text-[#303247]">{notice.title}</p>
                      <p className="mt-1 text-sm font-medium text-[#7d86a8]">{notice.body}</p>
                    </div>
                  ))}
                  {!summary.notices.length && <p className="rounded-xl bg-[#f7f8fd] p-4 text-center text-sm font-medium text-[#7d86a8]">No notices yet.</p>}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">
            <ReceiptText className="mx-auto mb-3 text-[#3033a1]" />
            No portal data available.
          </div>
        )}
      </section>
    </>
  );
}

export default function PortalPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <PortalDashboard />
      </AppShell>
    </AuthGate>
  );
}
