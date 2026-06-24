"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Payment } from "@/types/fee.types";
import { FeeStatusBadge, PaymentMethodBadge } from "@/components/FeeComponents";
import { PageHeader } from "@/components/PageHeader";

export default function PaymentsPage() {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Fee Payments"
          description="Record and manage fee payments from students"
        />
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
        >
          <Plus size={18} />
          Record Payment
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-4 border border-stone-200">
          <p className="text-sm text-stone-500">Total Payments</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">{payments.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 border border-stone-200">
          <p className="text-sm text-stone-500">Total Collected</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            ₹{totalCollected.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 border border-stone-200">
          <p className="text-sm text-stone-500">Average Payment</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
            ₹{payments.length > 0 ? Math.round(totalCollected / payments.length).toLocaleString("en-IN") : "0"}
          </p>
        </div>
      </div>

      {/* Payment Form */}
      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow-sm border border-stone-200">
          <h3 className="text-lg font-semibold text-stone-900 mb-4">Record New Payment</h3>
          <PaymentForm
            onSuccess={() => {
              setShowForm(false);
              fetchPayments();
            }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Payments List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-stone-500">Loading...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-stone-500">
            No payments recorded yet. Record your first payment to get started.
          </div>
        ) : (
          payments.map((payment) => (
            <div
              key={payment.id}
              className="rounded-lg bg-white p-4 border border-stone-200 hover:shadow-md transition"
            >
              <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
                <div>
                  <p className="text-xs text-stone-500">Student</p>
                  <p className="text-sm font-semibold">{payment.studentName}</p>
                  <p className="text-xs text-stone-500">{payment.admissionNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Amount</p>
                  <p className="text-sm font-bold text-emerald-600">₹{payment.amountPaid.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Method</p>
                  <PaymentMethodBadge method={payment.paymentMethod} />
                </div>
                <div>
                  <p className="text-xs text-stone-500">Date</p>
                  <p className="text-sm">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">Status</p>
                  <FeeStatusBadge status={payment.status} size="sm" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Form implementation details
    alert("Payment form implementation - connect to API");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center text-stone-500 py-8">
        Form fields for payment recording (Student, Amount, Method, etc.)
        <button
          type="button"
          onClick={onCancel}
          className="block mt-4 mx-auto px-4 py-2 bg-stone-200 text-stone-900 rounded"
        >
          Close
        </button>
      </div>
    </form>
  );
}
