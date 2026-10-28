"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import Link from "next/link";
import {
  CreditCard,
  CalendarCheck,
  Filter,
  RefreshCw,
  ReceiptText,
  Printer,
  Search,
  Plus,
  X,
  AlertCircle,
  TrendingDown
} from "lucide-react";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";

type PaymentRecord = {
  id: string;
  studentId: string;
  admissionNumber: string;
  studentName: string;
  amountPaid: number;
  remainingAmount: number;
  paymentMethod: string;
  paymentType: string;
  receiptNumber: string;
  receiptId: string;
  paymentDate: string;
  createdAt: string;
  status: string;
  remarks?: string | null;
  recordedBy?: string | null;
  transactionId?: string | null;
};

type FilterState = {
  academicYear: string;
  feeCategory: string;
  dateFrom: string;
  dateTo: string;
  paymentStatus: string;
  search: string;
};

const PAYMENT_METHODS = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card"];
const PAYMENT_TYPES = ["Tuition Fee", "Transport / Bus Fee", "Books / Uniform / Other", "Admission Fee", "Exam Fee"];

export function FeeLedgerTab({
  student,
  data,
  canViewFees,
  canCreateFees
}: {
  student: Record<string, unknown>;
  data: Record<string, unknown> | null;
  canViewFees: boolean;
  canCreateFees: boolean;
}) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    academicYear: "",
    feeCategory: "",
    dateFrom: "",
    dateTo: "",
    paymentStatus: "",
    search: ""
  });
  const [addFeeOpen, setAddFeeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error" | null; text: string }>({ type: null, text: "" });

  const studentId = String(student.id || "");

  useEffect(() => {
    loadPayments();
  }, [studentId, filters.academicYear, filters.feeCategory, filters.dateFrom, filters.dateTo, filters.paymentStatus, filters.search]);

  const loadPayments = useCallback(async () => {
    if (!canViewFees) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("studentId", studentId);
      params.set("pageSize", "100");
      if (filters.academicYear) params.set("academicYearId", filters.academicYear);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      if (filters.paymentStatus) params.set("status", filters.paymentStatus);

      const result = await adminApiRequest<{ success?: boolean; data?: PaymentRecord[] }>(
        `/api/admin/payments?${params.toString()}`
      );
      const list = (result.data || []).filter((p) => {
        if (filters.feeCategory && String(p.paymentType).toLowerCase() !== filters.feeCategory.toLowerCase()) return false;
        if (filters.search && !String(p.studentName || p.admissionNumber || p.receiptNumber || "").toLowerCase().includes(filters.search.toLowerCase())) return false;
        return true;
      });
      setPayments(list);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load fee ledger.");
    } finally {
      setLoading(false);
    }
  }, [studentId, canViewFees, filters]);

  const handleAddFee = async (e: FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const amountPaid = Number(formData.get("amountPaid"));
    const paymentMethod = String(formData.get("paymentMethod"));
    const paymentType = String(formData.get("paymentType"));
    const paymentDate = String(formData.get("paymentDate"));
    const transactionId = String(formData.get("transactionId") || "");
    const remarks = String(formData.get("remarks") || "");
    const idempotencyKey = `pay_${studentId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    if (!amountPaid || amountPaid <= 0) {
      setSubmitMessage({ type: "error", text: "Enter a valid amount greater than 0." });
      return;
    }
    if (!paymentMethod) {
      setSubmitMessage({ type: "error", text: "Select a payment method." });
      return;
    }
    if (!paymentDate) {
      setSubmitMessage({ type: "error", text: "Select a payment date." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminApiRequest<{ success?: boolean; data?: any; duplicate?: boolean }>(
        "/api/admin/payments",
        {
          method: "POST",
          body: JSON.stringify({
            studentId,
            amountPaid,
            paymentType,
            paymentMethod,
            paymentDate,
            transactionId: transactionId || undefined,
            remarks: remarks || undefined,
            idempotencyKey
          })
        }
      );
      if (result.data) {
        setSubmitMessage({ type: "success", text: result.duplicate ? "Payment already recorded (duplicate submission ignored)." : "Payment recorded successfully." });
        setAddFeeOpen(false);
        form.reset();
        await loadPayments();
      } else {
        setSubmitMessage({ type: "error", text: "Failed to record payment." });
      }
    } catch (err) {
      setSubmitMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to record payment." });
    } finally {
      setSubmitting(false);
    }
  };

  if (!canViewFees) {
    return (
      <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
        <CreditCard size={24} className="mx-auto mb-3 opacity-50" />
        <p>Fee access is not available for your role.</p>
      </div>
    );
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const totalDue = payments.length > 0 ? Number(payments[0]?.remainingAmount || 0) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-[#1f2136]">Fee Ledger</h2>
          <p className="text-sm font-medium text-[#7d86a8]">Payment history and outstanding balance for {String(student.studentName || "this student")}</p>
        </div>

        <div className="flex flex-wrap items-end gap-2 md:items-center">
          <button
            type="button"
            onClick={() => loadPayments()}
            disabled={loading}
            className="btn-secondary shrink-0"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> {loading ? "Loading…" : "Refresh"}
          </button>

          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="Academic year"
              value={filters.academicYear}
              onChange={(e) => setFilters({ ...filters, academicYear: e.target.value })}
              className="field text-xs"
            />
            <input
              type="text"
              placeholder="Fee category"
              value={filters.feeCategory}
              onChange={(e) => setFilters({ ...filters, feeCategory: e.target.value })}
              className="field text-xs"
            />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="field text-xs"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="field text-xs"
            />
            <select
              value={filters.paymentStatus}
              onChange={(e) => setFilters({ ...filters, paymentStatus: e.target.value })}
              className="field text-xs"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="text"
              placeholder="Search receipt…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="field text-xs"
            />
          </div>

          {canCreateFees && (
            <button type="button" onClick={() => setAddFeeOpen(true)} className="btn-primary shrink-0">
              <Plus size={14} className="mr-1" /> Add Fee
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4 border-l-4 border-[#eef0ff] bg-[#3033a1]/5">
          <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Total Paid</p>
          <p className="text-lg font-extrabold text-[#3033a1]">₹{totalPaid.toLocaleString("en-IN")}</p>
        </div>
        <div className="card p-4 border-l-4 border-[#e6f8ef] bg-[#0f8d52]/5">
          <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Outstanding</p>
          <p className="text-lg font-extrabold text-[#0f8d52]">₹{totalDue.toLocaleString("en-IN")}</p>
        </div>
        <div className="card p-4 border-l-4 border-[#e3e8ff] bg-[#f7f8fd]">
          <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">Transactions</p>
          <p className="text-lg font-extrabold text-[#1f2136]">{payments.length}</p>
        </div>
      </div>

      {error && (
        <div className="card border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>
      )}

      {payments.length === 0 && !error && !loading && (
        <div className="card p-8 text-center text-sm font-medium text-[#7d86a8]">
          <Search size={24} className="mx-auto mb-3 opacity-50" />
          <p>No fee payments found for the selected filters.</p>
        </div>
      )}

      {payments.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#edf0f7] bg-[#f7f8fd]">
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Receipt</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Category</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Amount</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Method</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Recorded By</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] text-right">Balance</th>
                <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wide text-[#7d86a8]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-[#f2f4fb] last:border-0 hover:bg-[#fafbff]">
                  <td className="px-4 py-3 text-xs font-medium text-[#303247]">
                    {new Date(p.paymentDate || p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#3033a1]">{p.receiptNumber || "—"}</td>
                  <td className="px-4 py-3 text-xs text-[#5a6488]">{p.paymentType}</td>
                  <td className="px-4 py-3 text-xs font-extrabold text-right text-[#18765e]">₹{Number(p.amountPaid || 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-xs text-[#5a6488]">{p.paymentMethod}</td>
                  <td className="px-4 py-3 text-xs text-[#5a6488] truncate" title={p.recordedBy || "—"}>
                    {p.recordedBy || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs font-extrabold text-right text-[#ad7413]">
                    ₹{Number(p.remainingAmount || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/receipts/${p.receiptId}`} className="btn-secondary">
                      <ReceiptText size={12} className="mr-1" /> View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addFeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setAddFeeOpen(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddFeeOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-[#1f2136]">Record Payment</h3>
              <button type="button" onClick={() => setAddFeeOpen(false)} className="rounded-lg hover:bg-[#f4f5fb]">
                <X size={18} />
              </button>
            </div>

            {submitMessage.text && (
              <div className={`mb-3 p-3 rounded-lg text-sm font-medium ${
                submitMessage.type === "success" ? "bg-[#e6f8ef] text-[#0f8d52] border border-[#d6f2e3]" : "bg-[#fff7f8] text-[#d84d5b] border border-[#ffeaea]"
              }`}>
                {submitMessage.text}
              </div>
            )}

            <form onSubmit={handleAddFee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    name="amountPaid"
                    min="0"
                    step="0.01"
                    required
                    className="field"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Payment Method</label>
                  <select name="paymentMethod" required className="field">
                    <option value="">Select method</option>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Fee Category</label>
                  <select name="paymentType" required className="field">
                    <option value="">Select category</option>
                    {PAYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Payment Date</label>
                  <input type="date" name="paymentDate" required className="field" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Transaction / Reference ID</label>
                <input type="text" name="transactionId" className="field" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[#7d86a8] mb-1">Remarks</label>
                <textarea name="remarks" rows={2} className="field" placeholder="Optional notes" />
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button type="button" onClick={() => setAddFeeOpen(false)} disabled={submitting} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Recording…" : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
