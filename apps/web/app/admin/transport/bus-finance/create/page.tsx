"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { hasPermission } from "@sri-narayana/shared";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";

const EMPTY = {
  vehicleName: "",
  vehicleNumber: "",
  financeCompany: "",
  loanAccountNumber: "",
  loanStartDate: "",
  loanEndDate: "",
  totalLoanAmount: "",
  downPayment: "",
  emiAmount: "",
  emiDueDay: "5",
  totalEmis: "",
  interestRate: "",
  notes: "",
};

export default function CreateBusFinancePage() {
  const router = useRouter();
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const canCreate = Boolean(role && hasPermission(role, "bus_finance.create"));

  const [form, setForm] = useState({ ...EMPTY });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const change = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) {
      setError("Your role cannot create bus loans.");
      return;
    }
    if (!selectedYear?.id) {
      setError("Select an academic year before creating a bus loan.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const payload = {
        vehicleName: form.vehicleName.trim(),
        vehicleNumber: form.vehicleNumber.trim(),
        financeCompany: form.financeCompany.trim(),
        loanAccountNumber: form.loanAccountNumber.trim(),
        loanStartDate: form.loanStartDate,
        loanEndDate: form.loanEndDate,
        totalLoanAmount: Number(form.totalLoanAmount || 0),
        downPayment: Number(form.downPayment || 0),
        emiAmount: Number(form.emiAmount || 0),
        emiDueDay: Number(form.emiDueDay || 1),
        totalEmis: Number(form.totalEmis || 0),
        academicYearId: selectedYear.id,
        interestRate: form.interestRate === "" ? undefined : Number(form.interestRate),
        notes: form.notes.trim(),
      };
      const res = await adminApiRequest<{ ok: boolean; id: string; emisGenerated: number }>("/api/admin/bus-finance", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/admin/transport/bus-finance/${res.id}`);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to create bus loan");
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate) {
    return (
      <>
        <PageHeader title="Add Bus Loan" description="Create a new vehicle finance record." />
        <section className="p-4 md:p-7">
          <div className="card max-w-2xl p-5 text-sm font-semibold text-[#d84d5b]">
            Your role does not have permission to create bus loans.
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Add Bus Loan" description="Create a vehicle finance record. The EMI schedule is generated automatically." />
      <section className="p-4 md:p-7">
        {!selectedYear?.id && <div className="card mb-4 p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year before creating a bus loan.</div>}
        <Link href="/admin/transport/bus-finance" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-[#3033a1]">
          <ArrowLeft size={16} /> Back to list
        </Link>

        {error && <div className="card mb-4 border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>}

        <form onSubmit={submit} className="card grid max-w-4xl grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <Field label="Bus / Vehicle Name *"><input name="vehicleName" value={form.vehicleName} onChange={change} required className="field mt-1" /></Field>
          <Field label="Vehicle Number *"><input name="vehicleNumber" value={form.vehicleNumber} onChange={change} required className="field mt-1" /></Field>
          <Field label="Finance Company / Bank *"><input name="financeCompany" value={form.financeCompany} onChange={change} required className="field mt-1" /></Field>
          <Field label="Loan Account Number *"><input name="loanAccountNumber" value={form.loanAccountNumber} onChange={change} required className="field mt-1" /></Field>
          <Field label="Loan Start Date *"><input type="date" name="loanStartDate" value={form.loanStartDate} onChange={change} required className="field mt-1" /></Field>
          <Field label="Loan End Date *"><input type="date" name="loanEndDate" value={form.loanEndDate} onChange={change} required className="field mt-1" /></Field>
          <Field label="Total Loan Amount (₹) *"><input type="number" min="0" name="totalLoanAmount" value={form.totalLoanAmount} onChange={change} required className="field mt-1" /></Field>
          <Field label="Down Payment (₹)"><input type="number" min="0" name="downPayment" value={form.downPayment} onChange={change} className="field mt-1" /></Field>
          <Field label="EMI Amount (₹) *"><input type="number" min="0" name="emiAmount" value={form.emiAmount} onChange={change} required className="field mt-1" /></Field>
          <Field label="EMI Due Day (1–31) *"><input type="number" min="1" max="31" name="emiDueDay" value={form.emiDueDay} onChange={change} required className="field mt-1" /></Field>
          <Field label="Total Number of EMIs *"><input type="number" min="1" name="totalEmis" value={form.totalEmis} onChange={change} required className="field mt-1" /></Field>
          <Field label="Interest Rate (%) — optional"><input type="number" step="0.01" min="0" name="interestRate" value={form.interestRate} onChange={change} className="field mt-1" /></Field>
          <div className="md:col-span-2">
            <Field label="Notes"><textarea name="notes" value={form.notes} onChange={change} rows={3} className="field mt-1" /></Field>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={loading} className="btn-primary disabled:opacity-60">
              {loading ? "Creating…" : "Create & Generate EMI Schedule"}
            </button>
            <Link href="/admin/transport/bus-finance" className="btn-secondary">Cancel</Link>
          </div>
        </form>
      </section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#5b6478]">{label}</span>
      {children}
    </label>
  );
}
