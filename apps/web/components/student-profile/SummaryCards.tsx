"use client";

import { IndianRupee, CalendarCheck, FileText, TrendingDown, AlertCircle, TrendingUp } from "lucide-react";

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
  const payments = data?.payments || [];
  const receipts = data?.receipts || [];
  const certificates = data?.certificates || [];

  const totalPaid = feeSummary?.paid || 0;
  const totalDue = feeSummary?.due || 0;
  const totalFee = feeSummary?.payableFee || 0;
  const concession = feeSummary?.concession || 0;
  const feeStatus = feeSummary?.status || "pending";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Fee"
        value={`₹${totalFee.toLocaleString("en-IN")}`}
        subtitle={concession > 0 ? `Concession: ₹${concession.toLocaleString("en-IN")}` : "Payable amount"}
        icon={<IndianRupee size={18} />}
        accent="bg-[#eef0ff] text-[#3033a1]"
        borderColor="border-[#e3e8ff]"
      />

      <StatCard
        title="Amount Paid"
        value={`₹${totalPaid.toLocaleString("en-IN")}`}
        subtitle={feeStatus === "paid" ? "Fully paid" : feeStatus === "partial" ? "Partially paid" : "No payment recorded"}
        icon={<TrendingUp size={18} />}
        accent="bg-[#e6f8ef] text-[#0f8d52]"
        borderColor="border-[#d6f2e3]"
      />

      <StatCard
        title="Outstanding Balance"
        value={`₹${totalDue.toLocaleString("en-IN")}`}
        subtitle={totalDue > 0 ? "Due now" : "No pending balance"}
        icon={<AlertCircle size={18} />}
        accent={totalDue > 0 ? "bg-[#fff7e6] text-[#ad7413]" : "bg-[#e6f8ef] text-[#0f8d52]"}
        borderColor={totalDue > 0 ? "border-[#ffe0c7]" : "border-[#d6f2e3]"}
      />

      <StatCard
        title="Documents & Certificates"
        value={`${receipts.length + certificates.length}`}
        subtitle={`${receipts.length} receipts · ${certificates.length} certificates`}
        icon={<FileText size={18} />}
        accent="bg-[#f4f5fb] text-[#3033a1]"
        borderColor="border-[#e3e8ff]"
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
  borderColor
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactElement;
  accent: string;
  borderColor: string;
}) {
  return (
    <div className={`card p-4 ${accent} ${borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#f7f8fd] text-[#3033a1]">{icon}</div>
        <div className="ml-auto text-right">
          <p className="text-[10px] uppercase tracking-wider text-[#7d86a8]">{title}</p>
          <p className="text-lg font-extrabold text-[#1f2136]">{value}</p>
        </div>
      </div>
      <p className="text-xs font-medium text-[#7d86a8]">{subtitle}</p>
    </div>
  );
}
