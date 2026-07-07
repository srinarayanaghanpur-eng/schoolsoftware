"use client";

import { PageHeader } from "@/components/PageHeader";
import { useAcademicYears } from "@/components/AcademicYearContext";
import { useAdminSession } from "@/components/AdminSessionContext";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { hasPermission } from "@sri-narayana/shared";
import {
  Bell,
  Users,
  IndianRupee,
  BarChart3,
  CheckCircle,
  XCircle,
  Clock,
  SkipForward,
  Layers,
  Play,
  Square,
  FlaskConical,
  RefreshCw
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type DashboardData = {
  totalDueStudents: number;
  totalDueAmount: number;
  remindersSentToday: number;
  remindersFailedToday: number;
  classWiseDue: { className: string; section: string; studentCount: number; totalDue: number }[];
  feeTypeWiseDue: { feeType: string; totalDue: number; studentCount: number }[];
  channelWiseReport: { whatsapp: { sent: number; failed: number }; sms: { sent: number; failed: number } };
  deliveryStatusReport: { sent: number; failed: number; pending: number; skipped: number; duplicate: number };
  remindersPending: number;
  remindersProcessing: number;
};

type StatusBadgeProps = { label: string; count: number; icon: ReactNode; className: string };

function StatCard({ title, value, icon, accent }: { title: string; value: string; icon: ReactNode; accent: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#7d86a8]">{title}</p>
        <span className={`rounded-lg p-2 ${accent}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[28px] font-extrabold leading-none text-[#1b1d32]">{value}</p>
    </div>
  );
}

function StatusBadge({ label, count, icon, className }: StatusBadgeProps) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${className}`}>
      {icon}
      <span>{label}</span>
      <span className="ml-auto">{count}</span>
    </div>
  );
}

export default function FeeRemindersDashboardPage() {
  const { role } = useAdminSession();
  const { selectedYear } = useAcademicYears();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ action: string; label: string } | null>(null);

  async function load() {
    if (!selectedYear?.id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ academicYearId: selectedYear.id });
      const result = await adminApiRequest<DashboardData>(`/api/admin/fee-reminder-dashboard?${params}`);
      setData(result);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [selectedYear?.id]);

  async function runAction(action: string) {
    if (!selectedYear?.id) return;
    setConfirmAction(null);
    setActionLoading(action);
    try {
      await adminApiRequest("/api/admin/fee-reminder-action", {
        method: "POST",
        body: JSON.stringify({ academicYearId: selectedYear.id, action })
      });
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : `Action "${action}" failed`);
    } finally {
      setActionLoading("");
    }
  }

  if (!hasPermission(role, "fee_reminders.view")) {
    return <section className="p-7"><div className="card p-5 font-semibold text-[#ed515d]">Access denied.</div></section>;
  }

  const ds = data?.deliveryStatusReport;

  return (
    <>
      <PageHeader
        title="Fee Reminder Dashboard"
        description="Monitor and manage automated fee reminders."
        action={
          <button className="btn-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
        }
      />

      <section className="space-y-5 p-4 md:p-7">
        {!selectedYear?.id && (
          <div className="card p-5 text-sm font-semibold text-[#7d86a8]">Select an academic year to view the dashboard.</div>
        )}

        {error && (
          <div className="card border-l-4 border-l-[#ed515d] p-4 text-sm font-semibold text-[#ed515d]">{error}</div>
        )}

        {loading && !data && (
          <div className="card py-10 text-center text-sm font-medium text-[#7d86a8]">Loading dashboard...</div>
        )}

        {data && (
          <>
            {/* Stat Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Total Due Students"
                value={String(data.totalDueStudents)}
                icon={<Users size={20} />}
                accent="bg-[#eef0ff] text-[#3033a1]"
              />
              <StatCard
                title="Total Due Amount"
                value={`₹${data.totalDueAmount.toLocaleString("en-IN")}`}
                icon={<IndianRupee size={20} />}
                accent="bg-[#e6f8ef] text-[#14a762]"
              />
              <StatCard
                title="Reminders Sent Today"
                value={String(data.remindersSentToday)}
                icon={<Bell size={20} />}
                accent="bg-[#fff4df] text-[#b8791a]"
              />
              <StatCard
                title="Failed Today"
                value={String(data.remindersFailedToday)}
                icon={<XCircle size={20} />}
                accent="bg-[#ffebed] text-[#ed515d]"
              />
            </div>

            {/* Action Buttons */}
            <div className="card flex flex-wrap gap-2 p-4">
              <button
                className="btn-primary"
                onClick={() => setConfirmAction({ action: "start_auto_reminder", label: "Start Auto Reminder" })}
                disabled={!!actionLoading}
              >
                <Play size={16} /> Start Auto Reminder
              </button>
              <button
                className="btn-secondary"
                onClick={() => setConfirmAction({ action: "stop_auto_reminder", label: "Stop" })}
                disabled={!!actionLoading}
              >
                <Square size={16} /> Stop
              </button>
              <button
                className="btn-secondary"
                onClick={() => void runAction("test_reminder")}
                disabled={!!actionLoading}
              >
                <FlaskConical size={16} /> Run Test
              </button>
              <button
                className="btn-secondary"
                onClick={() => void runAction("dry_run")}
                disabled={!!actionLoading}
              >
                <Layers size={16} /> Dry Run
              </button>
              <button
                className="btn-secondary"
                onClick={() => void runAction("retry_failed")}
                disabled={!!actionLoading}
              >
                <RefreshCw size={16} /> Retry Failed
              </button>
              {actionLoading && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#eef0ff] px-3 py-2 text-sm font-bold text-[#3033a1]">
                  <Clock size={16} /> {actionLoading}...
                </span>
              )}
            </div>

            {/* Class-wise Due Chart */}
            <div className="card p-5">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-[#3033a1]" />
                <h3 className="font-bold text-[#303247]">Class-wise Due</h3>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[400px] text-left text-sm">
                  <thead className="text-xs uppercase text-[#7d86a8]">
                    <tr>
                      <th className="pb-2 font-semibold">Class</th>
                      <th className="pb-2 font-semibold">Students</th>
                      <th className="pb-2 font-semibold">Total Due</th>
                      <th className="pb-2 font-semibold">Bar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classWiseDue.length === 0 ? (
                      <tr><td colSpan={4} className="py-6 text-center text-sm text-[#7d86a8]">No data</td></tr>
                    ) : (
                      data.classWiseDue.map((row) => {
                        const maxAmount = Math.max(...data.classWiseDue.map((r) => r.totalDue), 1);
                        const pct = (row.totalDue / maxAmount) * 100;
                        return (
                          <tr key={row.className} className="border-t border-[#edf0f7]">
                            <td className="py-3 font-semibold text-[#303247]">{row.className}</td>
                            <td className="py-3 text-[#7d86a8]">{row.studentCount}</td>
                            <td className="py-3 font-bold text-[#ed515d]">₹{row.totalDue.toLocaleString("en-IN")}</td>
                            <td className="py-3">
                              <div className="h-4 w-full rounded-full bg-[#eef0f7]">
                                <div
                                  className="h-4 rounded-full bg-[#3033a1] transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Channel Report + Delivery Status */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* Channel Report */}
              <div className="card p-5">
                <h3 className="font-bold text-[#303247]">Channel Report</h3>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-[#eef0ff] p-4">
                    <p className="text-sm font-bold text-[#3033a1]">WhatsApp</p>
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="font-semibold text-[#14a762]">Sent: {data.channelWiseReport.whatsapp.sent}</span>
                      <span className="font-semibold text-[#ed515d]">Failed: {data.channelWiseReport.whatsapp.failed}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#fff4df] p-4">
                    <p className="text-sm font-bold text-[#b8791a]">SMS</p>
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="font-semibold text-[#14a762]">Sent: {data.channelWiseReport.sms.sent}</span>
                      <span className="font-semibold text-[#ed515d]">Failed: {data.channelWiseReport.sms.failed}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery Status */}
              <div className="card p-5">
                <h3 className="font-bold text-[#303247]">Delivery Status</h3>
                <div className="mt-4 space-y-2">
                  {ds && (
                    <>
                      <StatusBadge label="Sent" count={ds.sent} icon={<CheckCircle size={16} />} className="bg-[#e6f8ef] text-[#14a762]" />
                      <StatusBadge label="Failed" count={ds.failed} icon={<XCircle size={16} />} className="bg-[#ffebed] text-[#ed515d]" />
                      <StatusBadge label="Pending" count={ds.pending} icon={<Clock size={16} />} className="bg-[#fff4df] text-[#b8791a]" />
                      <StatusBadge label="Skipped" count={ds.skipped} icon={<SkipForward size={16} />} className="bg-[#eef0f7] text-[#6b7391]" />
                      <StatusBadge label="Duplicate" count={ds.duplicate} icon={<Layers size={16} />} className="bg-[#f3f0ff] text-[#7c3aed]" />
                    </>
                  )}
                  {!ds && (
                    <p className="py-4 text-center text-sm text-[#7d86a8]">No delivery data</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Confirm Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmAction(null)}>
          <div className="card w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-[#1f2136]">Confirm Action</h2>
            <p className="mt-2 text-sm font-medium text-[#5f6888]">
              Are you sure you want to <strong>{confirmAction.label}</strong>?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setConfirmAction(null)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={() => void runAction(confirmAction.action)}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
