"use client";

import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { useAdminSession } from "@/components/AdminSessionContext";
import { PageHeader } from "@/components/PageHeader";
import { LiveClock } from "@/components/LiveClock";
import { usePortalChild } from "@/components/PortalChildContext";
import { adminApiRequest } from "@/lib/adminApiClient";
import { ROLES } from "@sri-narayana/shared";
import {
  Award,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MessageSquare,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
  User,
  UserCircle,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

function formatINR(amount: number) {
  return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
}

type DashboardSummary = {
  student: { id: string; name: string; className: string; section?: string; admissionNo?: string };
  fees: { total: number; paid: number; due: number; status?: string; feeBalanceCarriedForward?: number };

  marks: { examName: string; subject: string; marksObtained: number; maxMarks: number; grade?: string }[];
  notices: { title: string; body: string; createdAt?: string }[];
  recentPayments?: { id: string; amountPaid: number; paymentMethod: string; receiptNumber: string; createdAt: string }[];
  upcomingHolidays?: { title: string; date: string; type: string }[];
};

function NoLinkedStudents() {
  return (
    <section className="flex flex-col items-center justify-center p-8 text-center">
      <User size={48} className="mb-4 text-[#7d86a8]" />
      <h2 className="text-xl font-extrabold text-[#1b1d32]">No Student Linked</h2>
      <p className="mt-2 max-w-md text-sm font-medium text-[#7d86a8]">
        Your account is not linked to any student. Please contact the school administration to link your child&apos;s record.
      </p>
      <div className="mt-6 rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-5 py-4 text-sm font-semibold text-[#c83f4d]">
        Contact the school office for assistance.
      </div>
    </section>
  );
}

function firstName(name?: string) {
  if (!name) return "Parent";
  return name.trim().split(/\s+/)[0] || "Parent";
}

type QuickAction = { label: string; icon: LucideIcon; href?: string; onClick?: () => void; accent: string };

function PortalDashboard() {
  const { children, selectedChildId, selectedChild, switchChild, loading: childrenLoading } = usePortalChild();
  const { profile } = useAdminSession();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [receipt, setReceipt] = useState<{ receiptId: string; amount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminApiRequest<{ ok: true; summary: DashboardSummary }>(`/api/portal/summary?studentId=${encodeURIComponent(studentId)}`);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load portal summary.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedChildId) void loadSummary(selectedChildId);
  }, [selectedChildId]);

  const payNow = async () => {
    if (!summary || summary.fees.due <= 0) return;
    setPaying(true);
    setError(null);
    setReceipt(null);
    try {
      const order = await adminApiRequest<{ ok: true; orderId: string; amount: number }>("/api/fees/order", {
        method: "POST",
        body: JSON.stringify({ studentId: summary.student.id, amount: summary.fees.due, paymentType: "portal-fee", note: "Portal pay now" }),
      });
      const confirmation = await adminApiRequest<{ ok: true; receiptId: string; amount: number }>("/api/fees/confirm", {
        method: "POST",
        body: JSON.stringify({ orderId: order.orderId, transactionId: `PORTAL-${Date.now()}`, method: "online" }),
      });
      setReceipt({ receiptId: confirmation.receiptId, amount: confirmation.amount });
      await loadSummary(summary.student.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete payment.");
    } finally {
      setPaying(false);
    }
  };

  if (childrenLoading) {
    return (
      <section className="p-4 md:p-7">
        <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading portal...</div>
      </section>
    );
  }

  if (!childrenLoading && children.length === 0) {
    return (
      <PageHeader title="Parent Portal" description="Student and parent dashboard" />
    );
  }

  const paidPercent = summary && summary.fees.total > 0
    ? Math.min(100, Math.round((summary.fees.paid / summary.fees.total) * 100))
    : 0;
  const noDues = summary ? summary.fees.due <= 0 : false;

  const average = summary && summary.marks.length
    ? Math.round(
        (summary.marks.reduce((acc, m) => acc + (m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0), 0) /
          summary.marks.length) * 10,
      ) / 10
    : null;

  const quickActions: QuickAction[] = [
    { label: "Make Payment", icon: CreditCard, onClick: () => void payNow(), accent: "bg-[#eef0ff] text-[#3033a1]" },
    { label: "Download Receipt", icon: ReceiptText, href: "/portal/payments", accent: "bg-[#e6f8ef] text-[#0f8d52]" },
    { label: "Report Card", icon: Award, href: "/portal/exams", accent: "bg-[#fff3df] text-[#b87d0e]" },
    { label: "Notices", icon: BellRing, href: "/portal/notices", accent: "bg-[#fdeef0] text-[#d84d5b]" },
    { label: "Contact", icon: MessageSquare, href: "/portal/contact", accent: "bg-[#eaf3ff] text-[#2f6fed]" },
    { label: "Profile", icon: UserCircle, href: "/portal/profile", accent: "bg-[#f1ecff] text-[#6b46c1]" },
  ];

  return (
    <>
      <div className="dashboard-animate px-4 pt-5 md:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-[#1b1d32]">Dashboard</h2>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">
              Welcome back, {firstName(profile?.name)} <span aria-hidden>👋</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {children.length > 1 ? (
              <select
                className="field min-w-[220px]"
                value={selectedChildId}
                onChange={(e) => switchChild(e.target.value)}
              >
                {children.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} · Class {s.className}</option>
                ))}
              </select>
            ) : selectedChild ? (
              <span className="inline-flex items-center gap-2 rounded-2xl border border-[#e3e6f0] bg-white px-4 py-2.5 text-sm font-bold text-[#1b1d32]">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#eef0ff] text-[#3033a1]"><User size={15} /></span>
                {selectedChild.name} · Class {selectedChild.className}{selectedChild.section ? ` - ${selectedChild.section}` : ""}
              </span>
            ) : null}
            <LiveClock className="hidden sm:inline-flex" />
          </div>
        </div>
      </div>

      <section className="space-y-5 p-4 md:p-7">
        {error && <div className="rounded-2xl border border-[#ffd5da] bg-[#ffebed] px-4 py-3 text-sm font-semibold text-[#c83f4d]">{error}</div>}
        {receipt && <div className="rounded-2xl border border-[#c8f0dc] bg-[#e6f8ef] px-4 py-3 text-sm font-semibold text-[#0f8d52]">Receipt {receipt.receiptId} generated for {formatINR(receipt.amount)}.</div>}

        {loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">Loading dashboard...</div>
        ) : summary ? (
          <>
            {summary.fees.due > 0 && (
              <div className="dashboard-animate rounded-2xl border border-[#fff4df] bg-[#fffcf0] px-5 py-4">
                <div className="flex items-center gap-3">
                  <TriangleAlert size={20} className="text-[#b87d0e]" />
                  <p className="text-sm font-bold text-[#7d5d0a]">
                    Outstanding fee of {formatINR(summary.fees.due)} is due.
                    {summary.fees.feeBalanceCarriedForward ? ` (Includes ₹${summary.fees.feeBalanceCarriedForward.toLocaleString("en-IN")} carried forward)` : ""}
                  </p>
                </div>
              </div>
            )}

            {/* Metric cards — Total Fees / Paid / Due / Fee Status */}
            <div className="stagger-children grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#7d86a8]">Total Fees</p>
                    <p className="mt-3 text-[28px] font-extrabold leading-none text-[#1b1d32]">{formatINR(summary.fees.total)}</p>
                    <p className="mt-2 text-xs font-medium text-[#9aa2bd]">All inclusive</p>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]"><Wallet size={20} /></span>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#7d86a8]">Paid</p>
                    <p className="mt-3 text-[28px] font-extrabold leading-none text-[#13a961]">{formatINR(summary.fees.paid)}</p>
                    <p className="mt-2 text-xs font-medium text-[#9aa2bd]">{paidPercent}% completed</p>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e6f8ef] text-[#0f8d52]"><CheckCircle2 size={20} /></span>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#7d86a8]">Due</p>
                    <p className="mt-3 text-[28px] font-extrabold leading-none text-[#ed515d]">{formatINR(summary.fees.due)}</p>
                    <p className="mt-2 text-xs font-medium text-[#9aa2bd]">{noDues ? "No dues" : "Pending payment"}</p>
                  </div>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fdeef0] text-[#d84d5b]"><ReceiptText size={20} /></span>
                </div>
              </div>
              <div className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#7d86a8]">Fee Status</p>
                    <p className={`mt-3 text-[22px] font-extrabold capitalize leading-none ${noDues ? "text-[#13a961]" : "text-[#b87d0e]"}`}>
                      {noDues ? "No dues" : (summary.fees.status ?? "Pending")}
                    </p>
                    <p className="mt-2 text-xs font-medium text-[#9aa2bd]">{noDues ? "You're all set!" : "Action needed"}</p>
                  </div>
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${noDues ? "bg-[#e6f8ef] text-[#0f8d52]" : "bg-[#fff3df] text-[#b87d0e]"}`}>
                    <CheckCircle2 size={20} />
                  </span>
                </div>
              </div>
            </div>

            {/* Fee Payment + Performance Summary */}
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="card p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="font-extrabold text-[#1f2136]">Fee Payment</h2>
                    <p className="mt-1 text-sm font-medium text-[#7d86a8]">
                      {noDues ? "You're up to date with your fee payments." : "Pay the current outstanding amount online."}
                    </p>
                  </div>
                  <button className="btn-primary" onClick={() => void payNow()} disabled={paying || summary.fees.due <= 0}>
                    <CreditCard size={16} /> {paying ? "Processing..." : summary.fees.due > 0 ? `Pay ${formatINR(summary.fees.due)}` : "No dues"}
                  </button>
                </div>
                <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#eef0f7]">
                  <div className="h-full rounded-full bg-[#3033a1]" style={{ width: `${paidPercent}%` }} />
                </div>
                <div className="mt-3 flex justify-between text-xs font-medium text-[#7d86a8]">
                  <span>{formatINR(summary.fees.paid)} paid</span>
                  <span>{formatINR(summary.fees.due)} remaining</span>
                </div>
                {summary.fees.feeBalanceCarriedForward ? (
                  <div className="mt-4 rounded-xl bg-[#f7f8fd] p-3 text-xs font-medium text-[#7d86a8]">
                    Previous year carry forward: {formatINR(summary.fees.feeBalanceCarriedForward)}
                  </div>
                ) : null}
              </div>

              <div className="card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef0ff] text-[#3033a1]"><TrendingUp size={20} /></span>
                  <h2 className="font-extrabold text-[#1f2136]">Performance Summary</h2>
                </div>
                {average !== null ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl bg-[#f7f8fd] p-4">
                      <p className="text-xs font-semibold text-[#7d86a8]">Overall Average</p>
                      <p className="mt-2 text-[28px] font-extrabold leading-none text-[#1b1d32]">{average}%</p>
                    </div>
                    <div className="rounded-xl bg-[#f7f8fd] p-4">
                      <p className="text-xs font-semibold text-[#7d86a8]">Subjects Graded</p>
                      <p className="mt-2 text-[28px] font-extrabold leading-none text-[#1b1d32]">{summary.marks.length}</p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-[#f7f8fd] p-4 text-center text-sm font-medium text-[#7d86a8]">No published marks yet.</p>
                )}
                <div className="mt-4">
                  <Link href="/portal/exams" className="text-sm font-bold text-[#3033a1] hover:underline">View exam details →</Link>
                </div>
              </div>
            </div>

            {/* Upcoming Events + Quick Actions */}
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CalendarDays size={20} className="text-[#3033a1]" />
                    <h2 className="font-extrabold text-[#1f2136]">Upcoming Events</h2>
                  </div>
                  <Link href="/portal/notices" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#3033a1] hover:underline">
                    View all <ExternalLink size={14} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {(summary.upcomingHolidays ?? []).map((h, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-xl bg-[#f7f8fd] p-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#eef0ff] text-center leading-none text-[#3033a1]">
                        <span className="text-base font-extrabold">{h.date ? h.date.slice(8, 10) : "--"}</span>
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#303247]">{h.title}</p>
                        <p className="mt-0.5 text-xs font-medium text-[#7d86a8] capitalize">{h.date} · {h.type}</p>
                      </div>
                    </div>
                  ))}
                  {!(summary.upcomingHolidays ?? []).length && (
                    <p className="rounded-xl bg-[#f7f8fd] p-4 text-center text-sm font-medium text-[#7d86a8]">No upcoming events.</p>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Award size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Quick Actions</h2>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    const inner = (
                      <>
                        <span className={`grid h-11 w-11 place-items-center rounded-xl ${action.accent}`}><Icon size={20} /></span>
                        <span className="text-center text-xs font-bold leading-tight text-[#303247]">{action.label}</span>
                      </>
                    );
                    const className = "flex flex-col items-center gap-2 rounded-xl border border-[#edf0f7] bg-white p-4 transition hover:border-[#cdd3ec] hover:bg-[#f7f8fd]";
                    return action.href ? (
                      <Link key={action.label} href={action.href} className={className}>{inner}</Link>
                    ) : (
                      <button key={action.label} type="button" onClick={action.onClick} disabled={paying || noDues} className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>{inner}</button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recent Payments */}
            {summary.recentPayments && summary.recentPayments.length > 0 && (
              <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ReceiptText size={20} className="text-[#3033a1]" />
                    <h2 className="font-extrabold text-[#1f2136]">Recent Transactions</h2>
                  </div>
                  <Link href="/portal/payments" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#3033a1] hover:underline">
                    View all <ExternalLink size={14} />
                  </Link>
                </div>
                <div className="space-y-3">
                  {summary.recentPayments.map((pmt) => (
                    <div key={pmt.id} className="flex items-center justify-between rounded-xl bg-[#f7f8fd] p-3">
                      <div>
                        <p className="text-sm font-bold text-[#303247]">{formatINR(pmt.amountPaid)}</p>
                        <p className="text-xs font-medium text-[#7d86a8]">{pmt.createdAt} · {pmt.paymentMethod}</p>
                      </div>
                      <Link
                        href={`/portal/payments/${pmt.id}`}
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#3033a1] ring-1 ring-[#e3e6f0] transition hover:bg-[#eef0ff]"
                      >
                        Receipt
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Latest Exam Result + Recent Notices */}
            <div className="grid gap-5 xl:grid-cols-2">
              <div className="card overflow-hidden">
                <div className="flex items-center gap-3 border-b border-[#edf0f7] px-5 py-4">
                  <Award size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Latest Exam Result</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-[#f7f8fd] text-xs uppercase text-[#6f7898]">
                      <tr>
                        <th className="px-4 py-3">Exam</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Marks</th>
                        <th className="px-4 py-3">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.marks.map((mark, index) => (
                        <tr key={`${mark.examName}-${mark.subject}-${index}`} className="border-t border-[#edf0f7]">
                          <td className="px-4 py-3 font-semibold text-[#303247]">{mark.examName}</td>
                          <td className="px-4 py-3 text-[#7d86a8]">{mark.subject}</td>
                          <td className="px-4 py-3 font-bold text-[#303247]">{mark.marksObtained}/{mark.maxMarks}</td>
                          <td className="px-4 py-3">{mark.grade || "--"}</td>
                        </tr>
                      ))}
                      {!summary.marks.length && (
                        <tr><td className="px-4 py-6 text-center text-sm font-medium text-[#7d86a8]" colSpan={4}>No published marks yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[#edf0f7] px-5 py-3">
                  <Link href="/portal/exams" className="text-sm font-bold text-[#3033a1] hover:underline">View all exams →</Link>
                </div>
              </div>

              <div className="card p-5">
                <div className="mb-4 flex items-center gap-3">
                  <BellRing size={20} className="text-[#3033a1]" />
                  <h2 className="font-extrabold text-[#1f2136]">Recent Notices</h2>
                </div>
                <div className="space-y-3">
                  {summary.notices.slice(0, 3).map((notice, index) => (
                    <div key={`${notice.title}-${index}`} className="rounded-xl bg-[#f7f8fd] p-4">
                      <p className="font-bold text-[#303247]">{notice.title}</p>
                      <p className="mt-1 text-sm font-medium text-[#7d86a8] line-clamp-2">{notice.body}</p>
                    </div>
                  ))}
                  {!summary.notices.length && <p className="rounded-xl bg-[#f7f8fd] p-4 text-center text-sm font-medium text-[#7d86a8]">No notices yet.</p>}
                </div>
                <div className="mt-3">
                  <Link href="/portal/notices" className="text-sm font-bold text-[#3033a1] hover:underline">View all notices →</Link>
                </div>
              </div>
            </div>
          </>
        ) : summary === null && !loading ? (
          <div className="card p-8 text-center text-sm font-semibold text-[#7d86a8]">
            <ReceiptText className="mx-auto mb-3 text-[#3033a1]" />
            No portal data available.
          </div>
        ) : null}
      </section>
    </>
  );
}

export default function PortalPage() {
  return (
    <AuthGate roles={ROLES}>
      <AppShell>
        <PortalDashboard />
      </AppShell>
    </AuthGate>
  );
}
