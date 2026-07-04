"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Plus, Printer, XCircle } from "lucide-react";
import { Payment } from "@/types/fee.types";
import { FeeStatusBadge, PaymentMethodBadge } from "@/components/FeeComponents";
import { PageHeader } from "@/components/PageHeader";
import { PaginationControls } from "@/components/PaginationControls";
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";
import { adminApiRequest } from "@/lib/adminApiClient";
import { db, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { UpiQr, DEFAULT_UPI_ID, DEFAULT_UPI_PAYEE_NAME } from "@/components/UpiQr";
import { useRefreshOnFocus } from "@/lib/useRefreshOnFocus";
import { useClassSections } from "@/lib/useClassSections";

type PaymentMethod = "cash" | "bank_transfer" | "upi" | "cheque" | "card";

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

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];

const CLASS_OPTIONS = ["Nur", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
const RECEIPTS_PAGE_SIZE = 25;

function formatPaymentDate(value: unknown) {
  if (!value) return "--";
  if (typeof value === "string") return new Date(value).toLocaleDateString("en-IN");
  if (typeof value === "object" && value && "seconds" in value) {
    return new Date(Number((value as { seconds: number }).seconds) * 1000).toLocaleDateString("en-IN");
  }
  return new Date(String(value)).toLocaleDateString("en-IN");
}

export default function PaymentsPage() {
  const { role, profile } = useAdminSession();
  const canRecordPayment = Boolean(role && hasPermission(role, "fees.create"));
  const canCancelPayment = Boolean(role && hasPermission(role, "fees.create"));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [filterClass, setFilterClass] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterMethod, setFilterMethod] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const { sectionsByClass, sectionsFor } = useClassSections();
  // Section choices: the selected class's sections, or the union across
  // classes when no class filter is set.
  const filterSectionOptions = filterClass
    ? sectionsFor(filterClass)
    : Array.from(new Set(Object.values(sectionsByClass).flat())).sort();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Payment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments({ page: 0, cursor: null });
  }, []);
  useRefreshOnFocus(() => fetchPayments());

  const fetchPayments = async (options: { cursor?: string | null; page?: number } = {}) => {
    const targetPage = options.page ?? currentPage;
    const targetCursor = options.cursor !== undefined ? options.cursor : pageCursors[targetPage] ?? null;
    try {
      setError(null);
      setLoading(true);
      const params = new URLSearchParams({ pageSize: String(RECEIPTS_PAGE_SIZE) });
      if (filterClass) params.set("classId", filterClass);
      if (filterSection) params.set("sectionId", filterSection);
      if (filterMethod) params.set("paymentMode", filterMethod);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);
      if (targetCursor) params.set("cursor", targetCursor);
      const data = await adminApiRequest<{ success?: boolean; data: Payment[]; nextCursor?: string | null; hasMore?: boolean }>(`/api/admin/payments?${params}`);
      setPayments(data.data ?? []);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore));
      setCurrentPage(targetPage);
      setPageCursors((prev) => {
        const next = targetPage === 0 ? [null] : prev.slice(0, targetPage + 1);
        if (data.nextCursor) next[targetPage + 1] = data.nextCursor;
        return next;
      });
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      setError(error instanceof Error ? error.message : "Failed to load payments.");
      setPayments([]);
      setNextCursor(null);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchNextPaymentPage = () => {
    if (!nextCursor) return;
    fetchPayments({ page: currentPage + 1, cursor: nextCursor });
  };

  const fetchPreviousPaymentPage = () => {
    if (currentPage === 0) return;
    const previousPage = currentPage - 1;
    fetchPayments({ page: previousPage, cursor: pageCursors[previousPage] ?? null });
  };

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    setCancelError(null);
    setCancelSuccess(null);

    try {
      const result = await adminApiRequest<{ ok: boolean; approvalId?: string; message: string }>(
        `/api/admin/finance/receipt/${cancelTarget.id}/cancel`,
        {
          method: "POST",
          body: JSON.stringify({ reason: cancelReason.trim() }),
        }
      );
      setCancelSuccess(result.message || "Cancellation request submitted for approval.");
      setCancelTarget(null);
      setCancelReason("");
      fetchPayments({ page: currentPage, cursor: pageCursors[currentPage] ?? null });
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel receipt.");
    } finally {
      setCancelling(false);
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
            <p className="text-sm font-semibold text-[#7d86a8]">Page Receipts</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">{payments.length}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Page Collected</p>
            <p className="mt-3 text-[32px] font-extrabold leading-none text-[#1b1d32]">₹{totalCollected.toLocaleString("en-IN")}</p>
          </div>
          <div className="card p-5">
            <p className="text-sm font-semibold text-[#7d86a8]">Average Page Receipt</p>
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
                fetchPayments({ page: 0, cursor: null });
              }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        <div className="card flex flex-wrap items-end gap-3 p-4">
          <label className="text-xs font-semibold text-[#7d86a8]">
            Class
            <select className="field mt-1" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
              <option value="">All</option>
              {CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#7d86a8]">
            Section
            <select className="field mt-1" value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
              <option value="">All</option>
              {filterSectionOptions.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#7d86a8]">
            Mode
            <select className="field mt-1" value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
              <option value="">All</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>{pm.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#7d86a8]">
            From
            <input type="date" className="field mt-1" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
          </label>
          <label className="text-xs font-semibold text-[#7d86a8]">
            To
            <input type="date" className="field mt-1" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
          </label>
          <span className="inline-flex h-10 items-center rounded-xl border border-[#dfe3f1] bg-[#f7f8fd] px-3 text-sm font-bold text-[#303247]">
            25 / page
          </span>
          <button type="button" className="btn-secondary" onClick={() => fetchPayments({ page: 0, cursor: null })} disabled={loading}>
            Apply
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setFilterClass("");
              setFilterSection("");
              setFilterMethod("");
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
          >
            Clear
          </button>
        </div>

        <div className="space-y-3">
          {error && (
            <div className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">
              {error}
            </div>
          )}
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
                <div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf0f7] pt-3">
                  <a
                    href={`/admin/finance/receipt/${payment.id}`}
                    target="_blank"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#eeefff] px-3 py-1.5 text-xs font-bold text-[#3033a1] hover:bg-[#e3e5ff]"
                  >
                    <Printer size={14} />
                    Print Receipt
                  </a>
                  {canCancelPayment && payment.status === "completed" && (
                    <button
                      onClick={() => { setCancelTarget(payment); setCancelReason(""); setCancelError(null); }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#ffebed] px-3 py-1.5 text-xs font-bold text-[#ed515d] hover:bg-[#ffd5da]"
                    >
                      <XCircle size={14} />
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
          {(payments.length > 0 || currentPage > 0 || hasMore) && (
            <div className="card overflow-hidden">
              <PaginationControls
                page={currentPage}
                pageSize={RECEIPTS_PAGE_SIZE}
                itemCount={payments.length}
                itemLabel="receipts"
                hasPrevious={currentPage > 0}
                hasNext={hasMore}
                loading={loading}
                onPrevious={fetchPreviousPaymentPage}
                onNext={fetchNextPaymentPage}
                className="border-t-0"
              />
            </div>
          )}
        </div>
      </section>

      {cancelTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setCancelTarget(null)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1f2136]">Cancel Receipt</h3>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">
              This will create an approval request to cancel the payment of ₹{cancelTarget.amountPaid.toLocaleString("en-IN")} for {cancelTarget.studentName}.
            </p>
            {cancelSuccess ? (
              <div className="mt-4 rounded-xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">
                {cancelSuccess}
              </div>
            ) : (
              <>
                {cancelError && (
                  <div className="mt-4 rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{cancelError}</div>
                )}
                <label className="mt-4 block text-sm font-semibold text-[#303247]">
                  Reason for cancellation
                  <textarea
                    className="field mt-1 min-h-[80px] resize-y"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Explain why this payment needs to be cancelled..."
                    required
                  />
                </label>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="btn-primary" disabled={cancelling || !cancelReason.trim()} onClick={handleCancel}>
                    {cancelling ? "Submitting..." : "Submit Cancellation Request"}
                  </button>
                  <button type="button" onClick={() => setCancelTarget(null)} className="btn-secondary">
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PaymentForm({
  onSuccess,
  onCancel
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState("");
  const [studentClass, setStudentClass] = useState("1");
  const [studentSection, setStudentSection] = useState("A");
  const { sectionsFor } = useClassSections();
  const formSectionOptions = sectionsFor(studentClass);

  // Keep the section valid when the class (or its configured sections) changes.
  useEffect(() => {
    if (!formSectionOptions.includes(studentSection)) {
      setStudentSection(formSectionOptions[0] ?? "A");
    }
  }, [formSectionOptions, studentSection]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("tuition");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<{ receiptId: string; amount: number; providerOrderId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upi, setUpi] = useState<{ upiId: string; payeeName: string }>({ upiId: DEFAULT_UPI_ID, payeeName: DEFAULT_UPI_PAYEE_NAME });

  // Bank Transfer fields
  const [bankName, setBankName] = useState("");
  const [bankRef, setBankRef] = useState("");

  // Cheque fields
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");

  // Card fields
  const [cardType, setCardType] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [cardTxnId, setCardTxnId] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    getDoc(doc(db, "settings", "payment"))
      .then((snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data() as { upiId?: string; payeeName?: string };
        setUpi({ upiId: data.upiId || DEFAULT_UPI_ID, payeeName: data.payeeName || DEFAULT_UPI_PAYEE_NAME });
      })
      .catch(() => undefined);
  }, []);

  const loadStudents = async () => {
    setStudentsLoading(true);
    setError(null);
    const params = new URLSearchParams({
      pageSize: "25",
      class: studentClass,
      section: studentSection
    });
    if (studentSearch.trim()) params.set("q", studentSearch.trim());
    adminApiRequest<{ success?: boolean; data?: StudentOption[] }>(`/api/admin/students?${params}`)
      .then((result) => {
        setStudents(result.data ?? []);
      })
      .catch(() => setError("Unable to load students."))
      .finally(() => setStudentsLoading(false));
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const selectedStudent = students.find((student) => student.id === studentId);

  useEffect(() => {
    if (selectedStudent && !amount) {
      const due = Number(selectedStudent.totalFeesDue ?? 0);
      if (due > 0) setAmount(String(due));
    }
  }, [selectedStudent, amount]);

  const buildTransactionId = () => {
    const ts = Date.now();
    switch (method) {
      case "bank_transfer":
        return `BT-${ts}`;
      case "cheque":
        return `CQ-${chequeNumber || ts}`;
      case "card":
        return cardTxnId || `CARD-${ts}`;
      case "upi":
        return `UPI-${ts}`;
      default:
        return `CSH-${ts}`;
    }
  };

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
        body: JSON.stringify({ studentId, amount: payable, paymentType, note: buildMethodNote() })
      });
      const confirmation = await adminApiRequest<{ ok: true; receiptId: string; amount: number }>("/api/fees/confirm", {
        method: "POST",
        body: JSON.stringify({
          orderId: order.orderId,
          transactionId: buildTransactionId(),
          method
        })
      });
      const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
      setReceipt({ receiptId: confirmation.receiptId, amount: confirmation.amount, providerOrderId: order.providerOrderId });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete payment.");
    } finally {
      setLoading(false);
    }
  };

  const buildMethodNote = () => {
    const parts: string[] = [];
    if (note) parts.push(note);
    switch (method) {
      case "bank_transfer":
        if (bankName) parts.push(`Bank: ${bankName}`);
        if (bankRef) parts.push(`Ref: ${bankRef}`);
        break;
      case "cheque":
        if (chequeNumber) parts.push(`Cheque: ${chequeNumber}`);
        if (chequeBank) parts.push(`Bank: ${chequeBank}`);
        if (chequeDate) parts.push(`Date: ${chequeDate}`);
        break;
      case "card":
        if (cardType) parts.push(`Card: ${cardType}`);
        if (cardLast4) parts.push(`Last4: ${cardLast4}`);
        if (cardTxnId) parts.push(`Txn: ${cardTxnId}`);
        break;
    }
    return parts.join(" | ") || `Payment via ${method}`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="rounded-xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
      {receipt && (
        <div className="rounded-xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 size={17} />
            Receipt {receipt.receiptId} generated for ₹{receipt.amount.toLocaleString("en-IN")} via {PAYMENT_METHODS.find((m) => m.value === method)?.label || method}.
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-3 md:col-span-2 md:grid-cols-[1fr_1fr_2fr_auto]">
          <label className="text-sm font-semibold text-[#303247]">
            Class
            <select className="field mt-1" value={studentClass} onChange={(event) => setStudentClass(event.target.value)}>
              {CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#303247]">
            Section
            <select className="field mt-1" value={studentSection} onChange={(event) => setStudentSection(event.target.value)}>
              {formSectionOptions.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[#303247]">
            Search
            <input
              className="field mt-1"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  loadStudents();
                }
              }}
              placeholder="Name or admission number"
            />
          </label>
          <div className="flex items-end">
            <button type="button" className="btn-secondary w-full" onClick={loadStudents} disabled={studentsLoading}>
              {studentsLoading ? "Loading..." : "Load"}
            </button>
          </div>
        </div>
        <label className="text-sm font-semibold text-[#303247] md:col-span-2">
          Student
          <select className="field mt-1" value={studentId} onChange={(event) => setStudentId(event.target.value)} required>
            <option value="">{studentsLoading ? "Loading students..." : "Select student"}</option>
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
        <p className="mb-3 text-sm font-bold text-[#1f2136]">Payment Method</p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((pm) => (
            <button
              key={pm.value}
              type="button"
              onClick={() => setMethod(pm.value)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                method === pm.value
                  ? "bg-[#2d3094] text-white shadow-sm"
                  : "bg-white text-[#475067] ring-1 ring-[#e3e6f0] hover:bg-[#f3f4fb]"
              }`}
            >
              {pm.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {method === "cash" && (
            <div className="rounded-xl bg-[#e6f8ef] px-4 py-5 text-center text-sm font-semibold text-[#0f8d52]">
              Cash payment recorded
            </div>
          )}

          {method === "bank_transfer" && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-[#303247]">
                Bank Name
                <input className="field mt-1" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. HDFC Bank" />
              </label>
              <label className="text-sm font-semibold text-[#303247]">
                Transaction Reference
                <input className="field mt-1" value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="e.g. NEFT Ref No." />
              </label>
            </div>
          )}

          {method === "upi" && (
            <UpiQr
              upiId={upi.upiId}
              payeeName={upi.payeeName}
              amount={Number(amount) > 0 ? Number(amount) : undefined}
              note={selectedStudent ? `Fee - ${selectedStudent.studentName}` : "Fee payment"}
              size={190}
            />
          )}

          {method === "cheque" && (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-semibold text-[#303247]">
                Cheque Number
                <input className="field mt-1" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="e.g. 123456" />
              </label>
              <label className="text-sm font-semibold text-[#303247]">
                Bank Name
                <input className="field mt-1" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="e.g. SBI" />
              </label>
              <label className="text-sm font-semibold text-[#303247]">
                Date
                <input className="field mt-1" type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
              </label>
            </div>
          )}

          {method === "card" && (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-semibold text-[#303247]">
                Card Type
                <select className="field mt-1" value={cardType} onChange={(e) => setCardType(e.target.value)}>
                  <option value="">Select</option>
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="rupay">RuPay</option>
                  <option value="amex">Amex</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm font-semibold text-[#303247]">
                Last 4 Digits
                <input className="field mt-1" value={cardLast4} onChange={(e) => setCardLast4(e.target.value)} maxLength={4} placeholder="e.g. 1234" />
              </label>
              <label className="text-sm font-semibold text-[#303247]">
                Transaction ID
                <input className="field mt-1" value={cardTxnId} onChange={(e) => setCardTxnId(e.target.value)} placeholder="e.g. Txn123" />
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={loading}>
          {loading ? "Processing..." : `Pay via ${PAYMENT_METHODS.find((m) => m.value === method)?.label || method}`}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">Close</button>
      </div>
    </form>
  );
}
