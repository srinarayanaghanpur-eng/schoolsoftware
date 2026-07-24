"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { DatePicker } from "@/components/DatePicker";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { hasPermission } from "@sri-narayana/shared";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import { uploadFile } from "@/lib/uploadService";
import { EMI_PAYMENT_MODES, type BusFinance, type BusEmiPayment } from "@/types/busFinance.types";

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

const EMI_STATUS_STYLE: Record<string, string> = {
  paid: "bg-[#e7f6ec] text-[#1f8a4c]",
  partial: "bg-[#fff8ea] text-[#9f7116]",
  overdue: "bg-[#ffebed] text-[#d84d5b]",
  upcoming: "bg-[#e8f1ff] text-[#2563eb]",
  due: "bg-[#fff8ea] text-[#9f7116]",
  waived: "bg-[#f1f2f6] text-[#6b7280]",
};

export default function BusFinanceDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { role } = useAdminSession();
  const canView = Boolean(role && hasPermission(role, "bus_finance.view"));
  const canEdit = Boolean(role && hasPermission(role, "bus_finance.edit"));

  const [record, setRecord] = useState<BusFinance | null>(null);
  const [schedule, setSchedule] = useState<BusEmiPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [payTarget, setPayTarget] = useState<BusEmiPayment | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [rec, sched] = await Promise.all([
        adminApiRequest<{ ok: boolean; record: BusFinance }>(`/api/admin/bus-finance/${id}`),
        adminApiRequest<{ ok: boolean; schedule: BusEmiPayment[] }>(`/api/admin/bus-finance/${id}/emi-schedule`),
      ]);
      setRecord(rec.record);
      setSchedule(sched.schedule ?? []);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load loan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
  }, [canView, load]);

  const regenerate = async () => {
    setError("");
    setSuccess("");
    try {
      const res = await adminApiRequest<{ ok: boolean; emisGenerated: number }>(
        `/api/admin/bus-finance/${id}/emi-schedule`,
        { method: "POST" }
      );
      setSuccess(`Schedule checked. ${res.emisGenerated} missing EMI row(s) created.`);
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to regenerate schedule");
    }
  };

  if (!canView) {
    return (
      <>
        <PageHeader title="Bus Loan" description="Vehicle finance details." />
        <section className="p-4 md:p-7">
          <div className="card max-w-2xl p-5 text-sm font-semibold text-[#d84d5b]">Access denied.</div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={record ? `${record.vehicleName} (${record.vehicleNumber})` : "Bus Loan"}
        description="EMI schedule and payments."
      />
      <section className="space-y-5 p-4 md:p-7">
        <Link href="/admin/finance/bus-emi" className="inline-flex items-center gap-1 text-sm font-semibold text-[#3033a1]">
          <ArrowLeft size={16} /> Back to list
        </Link>

        {error && <div className="card border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>}
        {success && <div className="card border-l-4 border-[#1f8a4c] p-3 text-sm font-semibold text-[#1f8a4c]">{success}</div>}

        {loading ? (
          <div className="card p-6 text-sm text-[#7d86a8]">Loading…</div>
        ) : !record ? (
          <div className="card p-6 text-sm text-[#d84d5b]">Loan not found.</div>
        ) : (
          <>
            <LoanSummary record={record} schedule={schedule} canEdit={canEdit} onSaved={load} onError={setError} onSuccess={setSuccess} />

            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-[#edf0f7] px-5 py-3">
                <h3 className="text-sm font-bold text-[#1f2136]">EMI Schedule ({schedule.length})</h3>
                {canEdit && (
                  <button onClick={regenerate} className="inline-flex items-center gap-1 text-sm font-semibold text-[#3033a1]">
                    <RefreshCw size={14} /> Generate missing
                  </button>
                )}
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {schedule.map((emi) => (
                  <article key={emi.id} className="rounded-xl border border-[#edf0f7] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-bold">EMI #{emi.emiNumber}</p><p className="text-xs text-[#7d86a8]">{emi.dueDate} · {emi.emiMonth}</p></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${EMI_STATUS_STYLE[emi.status] ?? ""}`}>{emi.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Info label="Opening" value={inr(emi.openingBalance ?? 0)} />
                      <Info label="EMI / Paid" value={`${inr(emi.emiAmount)} / ${inr(emi.paidAmount)}`} />
                      <Info label="Principal" value={inr(emi.principalComponent ?? 0)} />
                      <Info label="Interest" value={inr(emi.interestComponent ?? 0)} />
                    </div>
                    {canEdit && emi.status !== "paid" && <button onClick={() => setPayTarget(emi)} className="mt-3 w-full rounded-lg bg-[#3033a1] px-3 py-2 text-xs font-bold text-white">Pay EMI</button>}
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#f7f8fc] text-xs uppercase tracking-wide text-[#7d86a8]">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Month</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">EMI</th>
                      <th className="px-4 py-3">Paid</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((emi) => (
                      <tr key={emi.id} className="border-t border-[#edf0f7]">
                        <td className="px-4 py-3 font-semibold">{emi.emiNumber}</td>
                        <td className="px-4 py-3">{emi.emiMonth}</td>
                        <td className="px-4 py-3">{emi.dueDate}</td>
                        <td className="px-4 py-3">{inr(emi.emiAmount)}</td>
                        <td className="px-4 py-3">
                          {inr(emi.paidAmount)}
                          {emi.status === "partial" && (
                            <span className="ml-1 text-xs text-[#9f7116]">(due {inr((Number(emi.emiAmount) || 0) - (Number(emi.paidAmount) || 0))})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${EMI_STATUS_STYLE[emi.status] ?? ""}`}>
                            {emi.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canEdit && emi.status !== "paid" && (
                            <button
                              onClick={() => setPayTarget(emi)}
                              className="rounded-lg bg-[#eceefb] px-2.5 py-1.5 text-xs font-semibold text-[#3033a1]"
                            >
                              Record Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {schedule.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-6 text-sm text-[#7d86a8]">No EMI rows. Use “Generate missing”.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {payTarget && record && (
        <PaymentModal
          emi={payTarget}
          vehicleNumber={record.vehicleNumber}
          onClose={() => setPayTarget(null)}
          onSaved={async () => {
            setPayTarget(null);
            setSuccess("Payment recorded.");
            await load();
          }}
          onError={setError}
        />
      )}
    </>
  );
}

function LoanSummary({
  record,
  schedule,
  canEdit,
  onSaved,
  onError,
  onSuccess,
}: {
  record: BusFinance;
  schedule: BusEmiPayment[];
  canEdit: boolean;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
  onSuccess: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    vehicleName: record.vehicleName,
    financeCompany: record.financeCompany,
    loanAccountNumber: record.loanAccountNumber,
    emiAmount: String(record.emiAmount ?? ""),
    interestRate: record.interestRate != null ? String(record.interestRate) : "",
    status: record.status,
    notes: record.notes ?? "",
    auditNote: "",
  });
  const [saving, setSaving] = useState(false);

  const totalPaid = schedule.reduce((s, e) => s + (Number(e.paidAmount) || 0), 0);

  const save = async () => {
    setSaving(true);
    onError("");
    try {
      await adminApiRequest(`/api/admin/bus-finance/${record.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          vehicleName: form.vehicleName,
          financeCompany: form.financeCompany,
          loanAccountNumber: form.loanAccountNumber,
          emiAmount: Number(form.emiAmount || 0),
          interestRate: form.interestRate === "" ? null : Number(form.interestRate),
          status: form.status,
          notes: form.notes,
          auditNote: form.auditNote,
        }),
      });
      onSuccess("Loan updated.");
      setEditing(false);
      await onSaved();
    } catch (err) {
      onError(err instanceof AdminApiError ? err.message : "Failed to update loan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1f2136]">Loan Details</h3>
        {canEdit && !editing && (
          <button onClick={() => setEditing(true)} className="text-sm font-semibold text-[#3033a1]">Edit</button>
        )}
      </div>

      {!editing ? (
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Info label="Finance Company" value={record.financeCompany} />
          <Info label="Loan A/C" value={record.loanAccountNumber} />
          <Info label="Loan Amount" value={inr(record.totalLoanAmount)} />
          <Info label="Down Payment" value={inr(record.downPayment)} />
          <Info label="EMI Amount" value={inr(record.emiAmount)} />
          <Info label="EMI Due Day" value={String(record.emiDueDay)} />
          <Info label="Total / Paid / Pending EMIs" value={`${record.totalEmis} / ${record.paidEmis} / ${record.pendingEmis}`} />
          <Info label="Total Paid" value={inr(totalPaid)} />
          <Info label="Start → End" value={`${record.loanStartDate} → ${record.loanEndDate}`} />
          <Info label="Interest Rate" value={record.interestRate != null ? `${record.interestRate}%` : "—"} />
          <Info label="Status" value={record.status} />
          {record.notes && <Info label="Notes" value={record.notes} />}
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <L label="Vehicle Name"><input className="field mt-1" value={form.vehicleName} onChange={(e) => setForm({ ...form, vehicleName: e.target.value })} /></L>
          <L label="Finance Company"><input className="field mt-1" value={form.financeCompany} onChange={(e) => setForm({ ...form, financeCompany: e.target.value })} /></L>
          <L label="Loan A/C Number"><input className="field mt-1" value={form.loanAccountNumber} onChange={(e) => setForm({ ...form, loanAccountNumber: e.target.value })} /></L>
          <L label="EMI Amount (₹)"><input type="number" className="field mt-1" value={form.emiAmount} onChange={(e) => setForm({ ...form, emiAmount: e.target.value })} /></L>
          <L label="Interest Rate (%)"><input type="number" step="0.01" className="field mt-1" value={form.interestRate} onChange={(e) => setForm({ ...form, interestRate: e.target.value })} /></L>
          <L label="Status">
            <select className="field mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BusFinance["status"] })}>
              <option value="active">Active</option>
              <option value="emi_due">EMI Due</option>
              <option value="paid_this_month">Paid This Month</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
              <option value="closed">Closed</option>
            </select>
          </L>
          <div className="md:col-span-2">
            <L label="Notes"><textarea className="field mt-1" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></L>
          </div>
          <div className="md:col-span-2">
            <L label="Audit note *"><textarea required className="field mt-1" rows={2} value={form.auditNote} onChange={(e) => setForm({ ...form, auditNote: e.target.value })} placeholder="Why is this financial record being changed?" /></L>
          </div>
          <div className="md:col-span-2 flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
            <button onClick={() => setEditing(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentModal({
  emi,
  vehicleNumber,
  onClose,
  onSaved,
  onError,
}: {
  emi: BusEmiPayment;
  vehicleNumber: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState({
    paidAmount: String(Math.max(0, Number(emi.emiAmount || 0) - Number(emi.paidAmount || 0))),
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentMode: "cash",
    transactionId: "",
    lateFee: String(emi.lateFee || ""),
    remarks: emi.remarks ?? "",
    proofUrl: emi.proofUrl ?? "",
    bankAccount: emi.bankAccount ?? "",
    principalComponent: String(emi.principalComponent ?? ""),
    interestComponent: String(emi.interestComponent ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFile(file, `bus-finance/${vehicleNumber}/proofs/${emi.emiNumber}-${file.name}`);
      setForm((f) => ({ ...f, proofUrl: url }));
    } catch {
      onError("Failed to upload proof.");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    onError("");
    try {
      await adminApiRequest(`/api/admin/bus-emi-payments/${emi.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          paidAmount: Number(form.paidAmount || 0),
          paymentDate: form.paymentDate,
          paymentMode: form.paymentMode,
          bankAccount: form.bankAccount,
          transactionId: form.transactionId,
          lateFee: Number(form.lateFee || 0),
          principalComponent: form.principalComponent === "" ? undefined : Number(form.principalComponent),
          interestComponent: form.interestComponent === "" ? undefined : Number(form.interestComponent),
          remarks: form.remarks,
          proofUrl: form.proofUrl,
        }),
      });
      await onSaved();
    } catch (err) {
      onError(err instanceof AdminApiError ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-[#1f2136]">Record EMI #{emi.emiNumber} — {vehicleNumber}</h3>
        <p className="mt-1 text-xs text-[#7d86a8]">Due {emi.dueDate} · EMI {inr(emi.emiAmount)}. Pay the full EMI for “paid”, or less for “partial”.</p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <L label="Paid Amount (₹)"><input type="number" min="0" className="field mt-1" value={form.paidAmount} onChange={(e) => setForm({ ...form, paidAmount: e.target.value })} /></L>
          <L label="Payment Date"><div className="mt-1"><DatePicker value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></div></L>
          <L label="Payment Mode">
            <select className="field mt-1" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
              {EMI_PAYMENT_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </L>
          <L label="Transaction / Cheque No."><input className="field mt-1" value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} /></L>
          <L label="Bank Account"><input className="field mt-1" value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} /></L>
          <L label="Principal Component"><input type="number" min="0" className="field mt-1" value={form.principalComponent} onChange={(e) => setForm({ ...form, principalComponent: e.target.value })} /></L>
          <L label="Interest Component"><input type="number" min="0" className="field mt-1" value={form.interestComponent} onChange={(e) => setForm({ ...form, interestComponent: e.target.value })} /></L>
          <L label="Late Fee (₹)"><input type="number" min="0" className="field mt-1" value={form.lateFee} onChange={(e) => setForm({ ...form, lateFee: e.target.value })} /></L>
          <L label="Proof (optional)"><input type="file" className="mt-1 text-xs" onChange={upload} /></L>
          <div className="sm:col-span-2">
            <L label="Remarks"><textarea className="field mt-1" rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></L>
          </div>
        </div>
        {form.proofUrl && <p className="mt-2 text-xs text-[#1f8a4c]">Proof attached ✓</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={save} disabled={saving || uploading} className="btn-primary disabled:opacity-60">
            {uploading ? "Uploading…" : saving ? "Saving…" : "Save Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#7d86a8]">{label}</p>
      <p className="font-semibold capitalize text-[#1f2136]">{value}</p>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#5b6478]">{label}</span>
      {children}
    </label>
  );
}
