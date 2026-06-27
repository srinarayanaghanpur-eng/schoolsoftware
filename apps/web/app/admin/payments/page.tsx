"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { Payment } from "@/types/fee.types";
import { FeeStatusBadge, PaymentMethodBadge } from "@/components/FeeComponents";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";
import { adminApiRequest } from "@/lib/adminApiClient";
import { db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { UpiQr } from "@/components/UpiQr";

type StudentOption = {
  id: string;
  admissionNumber?: string;
  studentName: string;
  class?: string;
  section?: string;
  totalFeesDue?: number;
  totalFeeAmount?: number;
  totalFeesPaid?: number;
};

function formatPaymentDate(value: unknown) {
  if (!value) return "--";
  if (typeof value === "string") return new Date(value).toLocaleDateString("en-IN");
  if (typeof value === "object" && value && "seconds" in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000).toLocaleDateString("en-IN");
  }
  return new Date(String(value)).toLocaleDateString("en-IN");
}

export default function PaymentsPage() {
  const { role } = useAdminSession();
  const canRecordPayment = Boolean(role && hasPermission(role, "fees.create"));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await fetch("/api/admin/payments");
      const data = await response.json();
      if (data.success) {
        setPayments(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalCollected = payments
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + p.amountPaid, 0);

  return (
    <>
      <PageHeader
        title="Fee Payments"
        description="Record and manage fee payments from students."
        action={
          canRecordPayment ? (
            <button onClick={() => setShowForm(!showForm)} className="btn-primary">
              <Plus size={18} />
              Record Payment
            </button>
          ) : null
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Total Payments</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">{payments.length}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Total Collected</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">₹{totalCollected.toLocaleString("en-IN")}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Average Payment</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">
              ₹{payments.length > 0 ? Math.round(totalCollected / payments.length).toLocaleString("en-IN") : "0"}
            </p>
          </div>
        </div>

        {showForm && canRecordPayment && (
          <div className="card p-5 md:p-6">
            <h3 className="mb-4 text-lg font-bold text-[#1f2136]">Record New Payment</h3>
            <PaymentForm
              onSuccess={() => {
                setShowForm(false);
                fetchPayments();
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <div className="space-y-3">
          {loading ? (
            <div className="card py-8 text-center text-sm font-medium text-[#7d86a8]">Loading...</div>
          ) : payments.length === 0 ? (
            <div className="card py-8 text-center text-sm font-medium text-[#7d86a8]">
              No payments recorded yet. Record your first payment to get started.
            </div>
          ) : (
            payments.map((payment) => (
              <div key={payment.id} className="card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#c7caf0]">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div>
                    <p className="text-xs font-semibold text-[#7d86a8]">Student</p>
                    <p className="mt-1 text-sm font-bold text-[#1f2136]">{payment.studentName || payment.studentId}</p>
                    <p className="text-xs font-medium text-[#7d86a8]">{payment.admissionNumber || "Online payment"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#7d86a8]">Amount</p>
                    <p className="mt-1 text-sm font-extrabold text-[#13a961]">₹{payment.amountPaid.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#7d86a8]">Method</p>
                    <div className="mt-1"><PaymentMethodBadge method={payment.paymentMethod} /></div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#7d86a8]">Date</p>
                    <p className="mt-1 text-sm font-semibold text-[#303247]">{formatPaymentDate(payment.paymentDate ?? payment.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#7d86a8]">Status</p>
                    <div className="mt-1"><FeeStatusBadge status={payment.status} size="sm" /></div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

// Simple payment form component
function PaymentForm({
  onSuccess,
  onCancel
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("tuition");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{ receiptId: string; amount: number; providerOrderId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upi, setUpi] = useState<{ upiId: string; payeeName: string }>({ upiId: "", payeeName: "" });

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    getDoc(doc(db, "settings", "payment"))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as { upiId?: string; payeeName?: string };
        setUpi({ upiId: data.upiId ?? "", payeeName: data.payeeName ?? "" });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch("/api/admin/students")
      .then((response) => response.json())
      .then((result: { success?: boolean; data?: StudentOption[] }) => {
        if (result.success) setStudents(result.data ?? []);
      })
      .catch(() => setError("Unable to load students."));
  }, []);

  const selectedStudent = students.find((student) => student.id === studentId);

  useEffect(() => {
    if (selectedStudent && !amount) {
      const due = Number(selectedStudent.totalFeesDue ?? 0);
      if (due > 0) setAmount(String(due));
    }
  }, [selectedStudent, amount]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReceipt(null);

    try {
      const payable = Number(amount);
      if (!studentId || !Number.isFinite(payable) || payable <= 0) {
        throw new Error("Select a student and enter a valid amount.");
      }

      const order = await adminApiRequest<{ ok: true; orderId: string; providerOrderId: string; amount: number }>("/api/fees/order", {
        method: "POST",
        body: JSON.stringify({ studentId, amount: payable, paymentType, note })
      });
      const confirmation = await adminApiRequest<{ ok: true; receiptId: string; amount: number }>("/api/fees/confirm", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.orderId,
          transactionId: `SIM-${Date.now()}`,
          method: "online"
        })
      });
      setReceipt({ receiptId: confirmation.receiptId, amount: confirmation.amount, providerOrderId: order.providerOrderId });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete payment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
      {receipt && (
        <div className="rounded-xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">
          <span className="inline-flex items-center gap-2"><CheckCircle2 size={17} /> Receipt {receipt.receiptId} generated for ₹{receipt.amount.toLocaleString("en-IN")}.</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-[#303247] md:col-span-2">
          Student
          <select className="field mt-1" value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.studentName} ({student.admissionNumber || student.id}) · Class {student.class || "--"}{student.section || ""} · Due ₹{Number(student.totalFeesDue ?? 0).toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-[#303247]">
          Amount
          <input className="field mt-1" type="number" min="1" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </label>
        <label className="text-sm font-semibold text-[#303247]">
          Payment type
          <select className="field mt-1" value={paymentType} onChange={(event) => setPaymentType(event.target.value)}>
            <option value="tuition">Tuition</option>
            <option value="term-1">Term 1</option>
            <option value="term-2">Term 2</option>
            <option value="books">Books</option>
            <option value="transport">Transport</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-[#303247] md:col-span-2">
          Note
          <input className="field mt-1" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional note" />
        </label>
      </div>

      <div className="rounded-2xl border border-[#e3e6f0] bg-[#f9faff] p-4">
        <p className="mb-3 text-sm font-bold text-[#1f2136]">Scan & Pay (UPI)</p>
        <UpiQr
          upiId={upi.upiId}
          payeeName={upi.payeeName}
          amount={Number(amount) > 0 ? Number(amount) : undefined}
          note={selectedStudent ? `Fee - ${selectedStudent.studentName}` : "Fee payment"}
          size={190}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={loading}>
          {loading ? "Processing..." : "Pay and confirm"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary"
        >
          Close
        </button>
      </div>
    </form>
  );
}
