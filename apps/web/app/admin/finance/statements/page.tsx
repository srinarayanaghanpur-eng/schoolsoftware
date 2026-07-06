"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import { Download, Printer } from "lucide-react";
import { useEffect, useState } from "react";

type Student = { id: string; admissionNumber: string; studentName: string; class: string; section: string; totalFeesDue: number; totalFeesPaid: number; totalFeeAmount: number; lastPaymentDate: string | null; feeStatus: string };
type Payment = { id: string; receiptNumber: string; amountPaid: number; paymentDate: string; paymentMethod: string; status: string };

function inr(n: number) { return `₹${(n || 0).toLocaleString("en-IN")}`; }

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

export default function StatementsPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [student, setStudent] = useState<Student | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedYear?.id) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }
    const academicYearId = selectedYear.id;
    (async () => {
      try {
        const params = new URLSearchParams({ academicYearId, pageSize: "25" });
        const r = await adminApiRequest<{ data: Student[] }>(`/api/admin/students?${params}`);
        setStudents(r.data);
      } catch (e) {
        setError(e instanceof AdminApiError ? e.message : "Failed to load students");
      } finally {
        setLoadingStudents(false);
      }
    })();
  }, [selectedYear?.id]);

  useEffect(() => {
    if (!selectedId || !selectedYear?.id) { setStudent(null); setPayments([]); return; }
    const academicYearId = selectedYear.id;
    (async () => {
      setLoadingStatement(true); setError("");
      try {
        const matched = students.find((s) => s.id === selectedId) || null;
        setStudent(matched);
        const params = new URLSearchParams({ studentId: selectedId, academicYearId, pageSize: "25" });
        const pRes = await adminApiRequest<{ data: Payment[] }>(`/api/admin/payments?${params}`);
        setPayments(pRes.data);
      } catch (e) {
        setError(e instanceof AdminApiError ? e.message : "Failed to load statement");
      } finally {
        setLoadingStatement(false);
      }
    })();
  }, [selectedId, selectedYear?.id]);

  const handlePrint = () => window.print();

  const handleExportCSV = () => {
    if (!student || payments.length === 0) return;
    const rows = payments.map((p) => `${fmt(p.paymentDate)},${p.receiptNumber || ""},${p.amountPaid},${p.paymentMethod},${p.status}`);
    const csv = `Date,Receipt #,Amount,Method,Status\n${rows.join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `statement-${student.admissionNumber}.csv`; a.click();
  };

  if (!hasPermission(role, "fees.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  const totalFee = student?.totalFeeAmount ?? 0;
  const totalPaid = student?.totalFeesPaid ?? 0;
  const dueAmount = Math.max(0, totalFee - totalPaid);

  return (
    <>
      <PageHeader title="Per-Student Fee Statement" description="View fee summary and payment history for individual students." />
      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load statements.</div>}
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="card p-5">
          <label className="text-sm font-semibold text-[#303247]">
            Select Student
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="field mt-1 block w-full"
            >
              <option value="">— Choose a student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.studentName} ({s.admissionNumber})</option>
              ))}
            </select>
          </label>
        </div>

        {loadingStatement && <div className="card p-8 text-center text-stone-400">Loading statement…</div>}

        {!loadingStatement && !student && selectedId && (
          <div className="card p-8 text-center text-stone-400">Student not found.</div>
        )}

        {student && (
          <>
            <div className="card p-5">
              <h3 className="mb-3 text-lg font-bold text-[#1f2136]">Student Info</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs font-semibold uppercase text-[#7d86a8]">Name</p><p className="font-semibold text-[#303247]">{student.studentName}</p></div>
                <div><p className="text-xs font-semibold uppercase text-[#7d86a8]">Class</p><p className="font-semibold text-[#303247]">{student.class} {student.section}</p></div>
                <div><p className="text-xs font-semibold uppercase text-[#7d86a8]">Admission No.</p><p className="font-semibold text-[#303247]">{student.admissionNumber}</p></div>
                <div><p className="text-xs font-semibold uppercase text-[#7d86a8]">Status</p><p className={`font-semibold ${student.feeStatus === "paid" ? "text-[#14a762]" : student.feeStatus === "partial" ? "text-[#e29813]" : "text-[#ed515d]"}`}>{student.feeStatus}</p></div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="card p-5"><p className="text-sm font-semibold text-[#7d86a8]">Total Fee</p><p className="mt-2 text-[26px] font-extrabold text-[#1b1d32]">{inr(totalFee)}</p></div>
              <div className="card p-5"><p className="text-sm font-semibold text-[#7d86a8]">Total Paid</p><p className="mt-2 text-[26px] font-extrabold text-[#14a762]">{inr(totalPaid)}</p></div>
              <div className="card p-5"><p className="text-sm font-semibold text-[#7d86a8]">Due Amount</p><p className={`mt-2 text-[26px] font-extrabold ${dueAmount === 0 ? "text-[#14a762]" : "text-[#ed515d]"}`}>{inr(dueAmount)}</p></div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#e3e6f0] bg-white">
              <div className="flex items-center justify-between border-b border-[#edf0f7] px-4 py-3">
                <h3 className="font-bold text-[#1f2136]">Payment History</h3>
                <div className="flex gap-2">
                  <button onClick={handlePrint} className="btn-secondary"><Printer size={16} /> Print</button>
                  <button onClick={handleExportCSV} className="btn-secondary"><Download size={16} /> Export</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-[#f7f8fd]">
                    <tr>
                      <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Date</th>
                      <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Receipt #</th>
                      <th className="border-b border-[#edf0f7] px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Amount</th>
                      <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Method</th>
                      <th className="border-b border-[#edf0f7] px-4 py-3 text-xs font-bold uppercase tracking-[0.03em] text-[#6f7898]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">No payments recorded.</td></tr>
                    ) : (
                      payments.map((p) => (
                        <tr key={p.id} className="border-b border-[#edf0f7] transition last:border-b-0 hover:bg-[#fafbff]">
                          <td className="px-4 py-3 font-medium text-[#303247]">{fmt(p.paymentDate)}</td>
                          <td className="px-4 py-3 text-[#6f7898]">{p.receiptNumber || "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold text-[#14a762]">{inr(p.amountPaid)}</td>
                          <td className="px-4 py-3 text-[#303247]">{p.paymentMethod}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.status === "completed" ? "bg-[#e6f8ef] text-[#14a762]" : "bg-[#fff4df] text-[#e29813]"}`}>{p.status}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!selectedId && !loadingStudents && (
          <div className="card py-12 text-center text-sm font-medium text-[#7d86a8]">Select a student above to view their fee statement.</div>
        )}
      </section>
    </>
  );
}
