"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Payment } from "@/types/fee.types";
import { FeeStatusBadge, PaymentMethodBadge } from "@/components/FeeComponents";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";

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
                    <p className="mt-1 text-sm font-bold text-[#1f2136]">{payment.studentName}</p>
                    <p className="text-xs font-medium text-[#7d86a8]">{payment.admissionNumber}</p>
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
                    <p className="mt-1 text-sm font-semibold text-[#303247]">{new Date(payment.paymentDate).toLocaleDateString()}</p>
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
  onCancel
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Form implementation details
    alert("Payment form implementation - connect to API");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-[#f7f8fd] py-8 text-center text-sm font-medium text-[#7d86a8]">
        Form fields for payment recording (Student, Amount, Method, etc.)
        <button
          type="button"
          onClick={onCancel}
          className="btn-secondary mx-auto mt-4 flex"
        >
          Close
        </button>
      </div>
    </form>
  );
}
