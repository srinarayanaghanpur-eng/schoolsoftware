"use client";

import { IndianRupee, FileText, TrendingUp, AlertCircle } from "lucide-react";

type FeeSummary = {
  originalFee: number;
  payableFee: number;
  concession: number;
  paid: number;
  due: number;
  status: "paid" | "partial" | "pending";
};

export function SummaryCards({
  data,
  canViewFees
}: {
  data: { feeSummary?: FeeSummary | null; payments?: unknown[]; receipts?: unknown[]; certificates?: unknown[] } | null;
  canViewFees: boolean;
}) {
  const feeSummary = data?.feeSummary || null;
  const receipts = data?.receipts || [];
  const certificates = data?.certificates || [];

  const totalPaid = feeSummary?.paid || 0;
  const totalDue = feeSummary?.due || 0;
  const totalFee = feeSummary?.payableFee || 0;
  const concession = feeSummary?.concession || 0;
  const feeStatus = feeSummary?.status || "pending";
  const paidPercent = totalFee > 0 ? Math.min(100, Math.round((totalPaid / totalFee) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Fee"
        value={`₹${totalFee.toLocaleString("en-IN")}`}
        subtitle={concession > 0 ? `Concession: ₹${concession.toLocaleString("en-IN")}` : "Payable amount"}
        icon={<IndianRupee size={18} />}
        accent="bg-primary/10 text-primary"
      />

      <StatCard
        title="Amount Paid"
        value={`₹${totalPaid.toLocaleString("en-IN")}`}
        subtitle={
          feeStatus === "paid"
            ? "Fully paid"
            : feeStatus === "partial"
              ? `${paidPercent}% of total fee paid`
              : "No payment recorded"
        }
        icon={<TrendingUp size={18} />}
        accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        progress={paidPercent}
      />

      <StatCard
        title="Outstanding Balance"
        value={`₹${totalDue.toLocaleString("en-IN")}`}
        subtitle={totalDue > 0 ? "Due now" : "No pending balance"}
        icon={<AlertCircle size={18} />}
        accent={
          totalDue > 0
            ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        }
      />

      <StatCard
        title="Documents"
        value={`${receipts.length + certificates.length}`}
        subtitle={`${receipts.length} receipts · ${certificates.length} certificates`}
        icon={<FileText size={18} />}
        accent="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  accent,
  progress
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactElement;
  accent: string;
  progress?: number;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${accent}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{subtitle}</p>
      {typeof progress === "number" && (
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
