"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Eye, IndianRupee, Bus, AlertTriangle, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useAdminSession } from "@/components/AdminSessionContext";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { hasPermission } from "@sri-narayana/shared";
import { adminApiRequest, AdminApiError } from "@/lib/adminApiClient";
import type { BusFinance } from "@/types/busFinance.types";

const inr = (n: number) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;

const STATUS_STYLE: Record<string, string> = {
  active: "bg-[#e7f6ec] text-[#1f8a4c]",
  closed: "bg-[#eceefb] text-[#3033a1]",
  overdue: "bg-[#ffebed] text-[#d84d5b]",
  cancelled: "bg-[#f1f2f6] text-[#6b7280]",
};

interface OverdueRow { overdueAmount?: number }
interface MonthlyRow { emiAmount?: number; status?: string }

export default function BusFinancePage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const canView = Boolean(role && hasPermission(role, "bus_finance.view"));
  const canCreate = Boolean(role && hasPermission(role, "bus_finance.create"));
  const canDelete = Boolean(role && hasPermission(role, "bus_finance.delete"));
  const canEdit = Boolean(role && hasPermission(role, "bus_finance.edit"));

  const [records, setRecords] = useState<BusFinance[]>([]);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [currentMonthDue, setCurrentMonthDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    if (!selectedYear?.id) {
      setRecords([]);
      setOverdueAmount(0);
      setCurrentMonthDue(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id, pageSize: "25" });
      const overdueParams = new URLSearchParams({ type: "overdue", academicYearId: selectedYear.id, pageSize: "25" });
      const monthlyParams = new URLSearchParams({ type: "monthly", academicYearId: selectedYear.id, pageSize: "25" });
      const [list, overdue, monthly] = await Promise.all([
        adminApiRequest<{ ok: boolean; records: BusFinance[] }>(`/api/admin/bus-finance?${params}`),
        adminApiRequest<{ ok: boolean; rows: OverdueRow[] }>(`/api/admin/bus-finance/reports?${overdueParams}`),
        adminApiRequest<{ ok: boolean; rows: MonthlyRow[] }>(`/api/admin/bus-finance/reports?${monthlyParams}`),
      ]);
      setRecords(list.records ?? []);
      setOverdueAmount((overdue.rows ?? []).reduce((s, r) => s + (Number(r.overdueAmount) || 0), 0));
      setCurrentMonthDue(
        (monthly.rows ?? [])
          .filter((r) => r.status !== "paid")
          .reduce((s, r) => s + (Number(r.emiAmount) || 0), 0)
      );
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to load bus finance records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) void load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, selectedYear?.id]);

  const cards = useMemo(() => {
    const active = records.filter((r) => r.status === "active" || r.status === "overdue");
    const totalLoanAmount = records.reduce((s, r) => s + (Number(r.totalLoanAmount) || 0), 0);
    const totalEmiPaid = records.reduce((s, r) => s + (Number(r.paidEmis) || 0) * (Number(r.emiAmount) || 0), 0);
    const totalEmiPending = records.reduce((s, r) => s + (Number(r.pendingEmis) || 0) * (Number(r.emiAmount) || 0), 0);
    const nextDue = records
      .filter((r) => r.status === "active" || r.status === "overdue")
      .map((r) => r.loanEndDate)
      .sort()[0];
    return { activeCount: active.length, totalLoanAmount, totalEmiPaid, totalEmiPending, nextDue };
  }, [records]);

  const closeLoan = async (id: string) => {
    if (!canEdit) return;
    setBusyId(id);
    setError("");
    setSuccess("");
    try {
      await adminApiRequest(`/api/admin/bus-finance/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      setSuccess("Loan marked as closed.");
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to close loan");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string, vehicleNumber: string) => {
    if (!canDelete) return;
    if (!window.confirm(`Delete finance record for ${vehicleNumber}? This deletes its EMI schedule too and cannot be undone.`)) return;
    setBusyId(id);
    setError("");
    setSuccess("");
    try {
      await adminApiRequest(`/api/admin/bus-finance/${id}`, { method: "DELETE" });
      setSuccess("Finance record deleted.");
      await load();
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Failed to delete record");
    } finally {
      setBusyId(null);
    }
  };

  if (!canView) {
    return (
      <>
        <PageHeader title="Bus Finance / EMI" description="Vehicle loan and EMI management." />
        <section className="p-4 md:p-7">
          <div className="card max-w-2xl p-5 text-sm font-semibold text-[#d84d5b]">
            Your role does not have access to Bus Finance.
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Bus Finance / EMI"
        description="Manage monthly EMI repayments for buses and vehicles bought on finance."
        action={
          canCreate ? (
            <Link href="/admin/transport/bus-finance/create" className="btn-primary">
              <Plus size={18} /> Add Bus Loan
            </Link>
          ) : undefined
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to load bus finance.</div>}
        {error && <div className="card border-l-4 border-[#d84d5b] p-3 text-sm font-semibold text-[#d84d5b]">{error}</div>}
        {success && <div className="card border-l-4 border-[#1f8a4c] p-3 text-sm font-semibold text-[#1f8a4c]">{success}</div>}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard icon={<Bus size={18} />} label="Active Loans" value={String(cards.activeCount)} />
          <SummaryCard icon={<IndianRupee size={18} />} label="Total Loan Amount" value={inr(cards.totalLoanAmount)} />
          <SummaryCard icon={<IndianRupee size={18} />} label="Total EMI Paid" value={inr(cards.totalEmiPaid)} />
          <SummaryCard icon={<IndianRupee size={18} />} label="Total EMI Pending" value={inr(cards.totalEmiPending)} />
          <SummaryCard icon={<CalendarClock size={18} />} label="This Month Due" value={inr(currentMonthDue)} />
          <SummaryCard icon={<AlertTriangle size={18} />} label="Overdue Amount" value={inr(overdueAmount)} highlight={overdueAmount > 0} />
        </div>

        <div className="card overflow-hidden p-0">
          <div className="flex items-center justify-between gap-3 border-b border-[#edf0f7] px-5 py-3">
            <h3 className="text-sm font-bold text-[#1f2136]">Vehicle Loans</h3>
            <Link href="/admin/transport/bus-finance/reports" className="text-sm font-semibold text-[#3033a1] hover:underline">
              View Reports →
            </Link>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-[#7d86a8]">Loading…</div>
          ) : records.length === 0 ? (
            <div className="p-6 text-sm text-[#7d86a8]">No bus loans yet. Click “Add Bus Loan” to create one.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f7f8fc] text-xs uppercase tracking-wide text-[#7d86a8]">
                  <tr>
                    <th className="px-4 py-3">Vehicle No.</th>
                    <th className="px-4 py-3">Finance Company</th>
                    <th className="px-4 py-3">EMI</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Pending</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Loan End</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-t border-[#edf0f7]">
                      <td className="px-4 py-3 font-semibold text-[#1f2136]">{r.vehicleNumber}</td>
                      <td className="px-4 py-3">{r.financeCompany}</td>
                      <td className="px-4 py-3">{inr(r.emiAmount)}</td>
                      <td className="px-4 py-3">{r.paidEmis}/{r.totalEmis}</td>
                      <td className="px-4 py-3">{r.pendingEmis}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${STATUS_STYLE[r.status] ?? ""}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{r.loanEndDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/transport/bus-finance/${r.id}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#eceefb] px-2.5 py-1.5 text-xs font-semibold text-[#3033a1]"
                          >
                            <Eye size={14} /> View / Pay
                          </Link>
                          {canEdit && r.status !== "closed" && (
                            <button
                              onClick={() => closeLoan(r.id)}
                              disabled={busyId === r.id}
                              className="rounded-lg bg-[#f1f2f6] px-2.5 py-1.5 text-xs font-semibold text-[#1f2136] disabled:opacity-50"
                            >
                              Close
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => remove(r.id, r.vehicleNumber)}
                              disabled={busyId === r.id}
                              className="rounded-lg bg-[#ffebed] px-2.5 py-1.5 text-xs font-semibold text-[#d84d5b] disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function SummaryCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? "border border-[#f6c1c6]" : ""}`}>
      <div className="flex items-center gap-2 text-[#7d86a8]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#eceefb] text-[#3033a1]">{icon}</span>
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className={`mt-2 text-lg font-extrabold ${highlight ? "text-[#d84d5b]" : "text-[#1f2136]"}`}>{value}</p>
    </div>
  );
}
