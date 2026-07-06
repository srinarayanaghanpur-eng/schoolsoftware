"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BankAccount, DebitVoucher, FinancePaymentMethod } from "@sri-narayana/shared";
import { hasPermission } from "@sri-narayana/shared";
import { FileDown, History, Plus, Printer, Search, X } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";

const CATEGORIES = ["utilities", "maintenance", "supplies", "vendor", "rent", "salary", "transport", "other"];
const PAYMENT_MODES: Array<{ value: FinancePaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "bank", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" }
];

const blankForm = {
  date: new Date().toISOString().slice(0, 10),
  paidTo: "",
  towards: "",
  expenseCategory: "utilities",
  amount: "",
  paymentMode: "cash" as FinancePaymentMethod,
  bankAccountId: "",
  cashAccountId: "",
  notes: ""
};

function inr(value: number) {
  return `₹${(Number(value) || 0).toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}-${month}-${year}` : value;
}

export default function DebitVouchersPage() {
  const router = useRouter();
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const canCreate = hasPermission(role, "fees.create");
  const [form, setForm] = useState(blankForm);
  const [showForm, setShowForm] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [vouchers, setVouchers] = useState<DebitVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] = useState("");
  const [cursor, setCursor] = useState("");
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [filters, setFilters] = useState({ voucherNo: "", date: "", paidTo: "", category: "", amount: "" });

  const hasSearch = useMemo(
    () => Boolean(filters.voucherNo || filters.date || filters.paidTo || filters.category || filters.amount),
    [filters]
  );

  async function load(cursorValue = "") {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "25" });
      if (!hasSearch && selectedYear?.name) query.set("academicYear", selectedYear.name);
      if (!hasSearch && cursorValue) query.set("cursor", cursorValue);
      if (filters.voucherNo) query.set("voucherNo", filters.voucherNo);
      if (filters.date) query.set("date", filters.date);
      if (filters.paidTo) query.set("paidTo", filters.paidTo);
      if (filters.category) query.set("category", filters.category);
      if (filters.amount) query.set("amount", filters.amount);
      const result = await adminApiRequest<{ vouchers: DebitVoucher[]; nextCursor?: string }>(`/api/admin/finance/debit-vouchers?${query}`);
      setVouchers(result.vouchers);
      setNextCursor(result.nextCursor ?? "");
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Unable to load debit vouchers");
    } finally {
      setLoading(false);
    }
  }

  async function loadBankAccounts() {
    try {
      const result = await adminApiRequest<{ accounts: BankAccount[] }>("/api/admin/finance/bank-accounts");
      setBankAccounts(result.accounts);
    } catch {
      setBankAccounts([]);
    }
  }

  useEffect(() => {
    void load("");
  }, [selectedYear?.name, hasSearch]);

  useEffect(() => {
    void loadBankAccounts();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await adminApiRequest<{ voucherId: string; voucherNo: number }>("/api/admin/finance/debit-vouchers", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          academicYearId: selectedYear?.id ?? "",
          academicYear: selectedYear?.name ?? ""
        })
      });
      setForm(blankForm);
      router.push(`/vouchers/${result.voucherId}`);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Unable to save debit voucher");
    } finally {
      setSaving(false);
    }
  }

  function applySearch(e: FormEvent) {
    e.preventDefault();
    setCursor("");
    setCursorStack([]);
    void load("");
  }

  function clearSearch() {
    setFilters({ voucherNo: "", date: "", paidTo: "", category: "", amount: "" });
    setCursor("");
    setCursorStack([]);
  }

  function goNext() {
    if (!nextCursor || hasSearch) return;
    setCursorStack((current) => [...current, cursor]);
    setCursor(nextCursor);
    void load(nextCursor);
  }

  function goPrev() {
    if (hasSearch || cursorStack.length === 0) return;
    const stack = [...cursorStack];
    const previous = stack.pop() ?? "";
    setCursorStack(stack);
    setCursor(previous);
    void load(previous);
  }

  if (!hasPermission(role, "fees.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  return (
    <>
      <PageHeader title="Debit Vouchers" description="Create expense vouchers and print A4 voucher sheets." />
      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>}

        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setShowForm((value) => !value)}>
            {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? "Close Entry" : "Create Debit Voucher"}
          </button>
          <Link className="btn-secondary" href="#voucher-history">
            <History size={16} /> Voucher History
          </Link>
        </div>

        {showForm && (
          <form onSubmit={submit} className="card grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-sm font-semibold text-[#303247]">Date
              <div className="mt-1"><DatePicker required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            </label>
            <label className="text-sm font-semibold text-[#303247]">Paid To
              <input className="field mt-1" required value={form.paidTo} onChange={(e) => setForm({ ...form, paidTo: e.target.value })} placeholder="Vendor, staff or receiver name" />
            </label>
            <label className="text-sm font-semibold text-[#303247]">Expense Category
              <select className="field mt-1" value={form.expenseCategory} onChange={(e) => setForm({ ...form, expenseCategory: e.target.value })}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold text-[#303247]">Amount (₹)
              <input className="field mt-1" type="number" min="1" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </label>
            <label className="text-sm font-semibold text-[#303247]">Payment Mode
              <select className="field mt-1" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value as FinancePaymentMethod })}>
                {PAYMENT_MODES.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
              </select>
            </label>
            {form.paymentMode !== "cash" && (
              <label className="text-sm font-semibold text-[#303247]">Bank Account
                <select className="field mt-1" value={form.bankAccountId} onChange={(e) => setForm({ ...form, bankAccountId: e.target.value })}>
                  <option value="">Do not update bank book</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name} {account.bankName ? `- ${account.bankName}` : ""}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="text-sm font-semibold text-[#303247] md:col-span-2 xl:col-span-3">Towards / Purpose
              <input className="field mt-1" required value={form.towards} onChange={(e) => setForm({ ...form, towards: e.target.value })} placeholder="e.g. Electricity bill for June" />
            </label>
            <label className="text-sm font-semibold text-[#303247] md:col-span-2 xl:col-span-3">Notes
              <textarea className="field mt-1 min-h-[84px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
            <div className="md:col-span-2 xl:col-span-3">
              <button className="btn-primary" disabled={saving || !canCreate}>
                {saving ? "Saving..." : "Save & Generate Voucher"}
              </button>
            </div>
          </form>
        )}

        <article id="voucher-history" className="space-y-4">
          <form onSubmit={applySearch} className="card grid gap-3 p-4 md:grid-cols-5">
            <input className="field" placeholder="Voucher number" value={filters.voucherNo} onChange={(e) => setFilters({ ...filters, voucherNo: e.target.value })} />
            <DatePicker value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
            <input className="field" placeholder="Paid to" value={filters.paidTo} onChange={(e) => setFilters({ ...filters, paidTo: e.target.value })} />
            <select className="field" value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <div className="flex gap-2">
              <input className="field" type="number" min="1" placeholder="Amount" value={filters.amount} onChange={(e) => setFilters({ ...filters, amount: e.target.value })} />
              <button className="btn-primary px-3" title="Search"><Search size={16} /></button>
              <button type="button" className="btn-secondary px-3" onClick={clearSearch} title="Clear"><X size={16} /></button>
            </div>
          </form>

          <div className="card overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-4 py-3">Voucher No.</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Paid To</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Towards</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Prints</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">Loading...</td></tr>
                ) : vouchers.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-stone-400">No debit vouchers found</td></tr>
                ) : vouchers.map((voucher) => (
                  <tr key={voucher.id} className="border-t border-stone-100">
                    <td className="px-4 py-3 font-bold text-[#1f2136]">{voucher.voucherNo}</td>
                    <td className="px-4 py-3 text-stone-500">{formatDate(voucher.date)}</td>
                    <td className="px-4 py-3">{voucher.paidTo}</td>
                    <td className="px-4 py-3 capitalize">{voucher.expenseCategory}</td>
                    <td className="max-w-[280px] truncate px-4 py-3">{voucher.towards}</td>
                    <td className="px-4 py-3 text-right font-semibold">{inr(voucher.amount)}</td>
                    <td className="px-4 py-3">{voucher.printCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href={`/vouchers/${voucher.id}`} className="btn-secondary px-3">Preview</Link>
                        <Link href={`/vouchers/print/${voucher.id}?copies=4`} className="btn-secondary px-3" title="Print four copies"><Printer size={15} /></Link>
                        <Link href={`/vouchers/print/${voucher.id}?copies=1`} className="btn-secondary px-3" title="Download PDF"><FileDown size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!hasSearch && (
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={goPrev} disabled={cursorStack.length === 0}>Previous</button>
              <button type="button" className="btn-secondary" onClick={goNext} disabled={!nextCursor}>Next</button>
            </div>
          )}
        </article>
      </section>
    </>
  );
}
