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

const TONES = {
  primary: {
    icon: "bg-primary/10 text-primary",
    glow: "bg-primary/15",
    bar: "bg-gradient-to-r from-primary to-[#7c6cf0]"
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    glow: "bg-emerald-400/15",
    bar: "bg-gradient-to-r from-emerald-500 to-teal-400"
  },
  rose: {
    icon: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    glow: "bg-rose-400/15",
    bar: "bg-gradient-to-r from-rose-500 to-orange-400"
  },
  violet: {
    icon: "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
    glow: "bg-violet-400/15",
    bar: "bg-gradient-to-r from-violet-500 to-fuchsia-400"
  }
} as const;

export function SummaryCards({
  data
}: {
  data: { feeSummary?: FeeSummary | null; payments?: unknown[]; receipts?: unknown[]; certificates?: unknown[] } | null;
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
    <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Fee"
        value={`₹${totalFee.toLocaleString("en-IN")}`}
        subtitle={concession > 0 ? `Concession: ₹${concession.toLocaleString("en-IN")}` : "Payable amount"}
        icon={<IndianRupee size={19} />}
        tone="primary"
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
        icon={<TrendingUp size={19} />}
        tone="emerald"
        progress={paidPercent}
      />

      <StatCard
        title="Outstanding Balance"
        value={`₹${totalDue.toLocaleString("en-IN")}`}
        subtitle={totalDue > 0 ? "Due now" : "No pending balance"}
        icon={<AlertCircle size={19} />}
        tone={totalDue > 0 ? "rose" : "emerald"}
      />

      <StatCard
        title="Documents"
        value={`${receipts.length + certificates.length}`}
        subtitle={`${receipts.length} receipts · ${certificates.length} certificates`}
        icon={<FileText size={19} />}
        tone="violet"
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone,
  progress
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactElement;
  tone: keyof typeof TONES;
  progress?: number;
}) {
  const palette = TONES[tone];
  return (
    <div className="profile-stat card group relative overflow-hidden p-5">
      <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-3xl ${palette.glow}`} aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-extrabold leading-none tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        </div>
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${palette.icon}`}>
          <span className="transition-transform duration-300 group-hover:scale-110">{icon}</span>
        </div>
      </div>
      <p className="relative mt-3 text-xs font-medium text-muted-foreground">{subtitle}</p>
      {typeof progress === "number" && (
        <div className="profile-progress mt-4 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <span className={palette.bar} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
