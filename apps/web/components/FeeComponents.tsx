"use client";

import clsx from "clsx";
import {
  CheckCircle2,
  XCircle,
  Clock,
  IndianRupee,
  TrendingUp,
  Users
} from "lucide-react";
import { Concession, Payment, DashboardStats } from "@/types/fee.types";
import { getClassDisplayName } from "@/lib/classUtils";

/**
 * Fee Status Badge Component
 */
export function FeeStatusBadge({
  status,
  size = "md"
}: {
  status: "pending" | "approved" | "rejected" | "completed" | "pending_payment";
  size?: "sm" | "md" | "lg";
}) {
  const configs = {
    approved: {
      bg: "bg-[#e6f8ef]",
      text: "text-[#13a961]",
      icon: CheckCircle2
    },
    rejected: {
      bg: "bg-[#ffebed]",
      text: "text-[#ed515d]",
      icon: XCircle
    },
    pending: {
      bg: "bg-[#fff4df]",
      text: "text-[#d79418]",
      icon: Clock
    },
    completed: {
      bg: "bg-[#eeefff]",
      text: "text-[#3033a1]",
      icon: CheckCircle2
    },
    pending_payment: {
      bg: "bg-[#fff4df]",
      text: "text-[#d79418]",
      icon: IndianRupee
    }
  };

  const config = configs[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-1 text-xs gap-1",
    md: "px-3 py-1.5 text-sm gap-2",
    lg: "px-4 py-2 text-base gap-2"
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-semibold",
        config.bg,
        config.text,
        sizeClasses[size]
      )}
    >
      <Icon size={size === "sm" ? 14 : size === "md" ? 16 : 18} />
      {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
    </span>
  );
}

/**
 * Fee Summary Card Component
 */
export function FeeSummaryCard({
  title,
  amount,
  icon: Icon,
  trend,
  color = "blue"
}: {
  title: string;
  amount: number | string;
  icon: any;
  trend?: { value: number; direction: "up" | "down" };
  color?: "blue" | "green" | "red" | "amber" | "purple";
}) {
  const colorClasses = {
    blue: "bg-[#eeefff] text-[#3033a1]",
    green: "bg-[#e6f8ef] text-[#13a961]",
    red: "bg-[#ffebed] text-[#ed515d]",
    amber: "bg-[#fff4df] text-[#d79418]",
    purple: "bg-[#f0edff] text-[#5751b8]"
  };

  return (
    <div className="card p-5 transition duration-200 hover:-translate-y-0.5 hover:border-[#c7caf0]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-[#7d86a8]">{title}</p>
          <p className="mt-3 text-[32px] font-extrabold leading-none tracking-tight text-[#1b1d32]">
            {typeof amount === "number" ? `₹${amount.toLocaleString("en-IN")}` : amount}
          </p>
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-xs">
              {trend.direction === "up" ? (
                <TrendingUp size={14} className="text-green-600" />
              ) : (
                <TrendingUp size={14} className="text-red-600 rotate-180" />
              )}
              <span className={trend.direction === "up" ? "text-green-600" : "text-red-600"}>
                {trend.value}% {trend.direction === "up" ? "increase" : "decrease"}
              </span>
            </div>
          )}
        </div>
        <div className={clsx("grid h-11 w-11 place-items-center rounded-xl", colorClasses[color])}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

/**
 * Concession List Item Component
 */
export function ConcessionListItem({
  concession,
  onView,
  onEdit,
  onApprove,
  onReject,
  onDelete
}: {
  concession: Concession;
  onView?: () => void;
  onEdit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#c7caf0]">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <div>
          <p className="text-xs font-semibold text-[#7d86a8]">Student</p>
          <p className="mt-1 text-sm font-bold text-[#1f2136]">{concession.studentName}</p>
          <p className="text-xs font-medium text-[#7d86a8]">{concession.admissionNumber}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#7d86a8]">Class/Section</p>
          <p className="mt-1 text-sm font-semibold text-[#303247]">{getClassDisplayName(concession.class)}/{concession.section}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#7d86a8]">Type & Amount</p>
          <p className="mt-1 text-sm font-semibold text-[#303247]">
            {concession.concessionType === "percentage"
              ? `${concession.concessionPercent}%`
              : `₹${concession.concessionAmount}`}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#7d86a8]">Status</p>
          <div className="mt-1">
            <FeeStatusBadge status={concession.status} size="sm" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-[#7d86a8]">Actions</p>
          <div className="mt-1 flex gap-2">
            {onView && (
              <button
                onClick={onView}
                className="rounded-lg bg-[#eeefff] px-2 py-1 text-xs font-bold text-[#3033a1] hover:bg-[#e3e5ff]"
              >
                View
              </button>
            )}
            {concession.status === "pending" && onEdit && (
              <button
                onClick={onEdit}
                className="rounded-lg bg-[#fff4df] px-2 py-1 text-xs font-bold text-[#d79418] hover:bg-[#ffe9bd]"
              >
                Edit
              </button>
            )}
            {concession.status === "pending" && onApprove && (
              <button
                onClick={onApprove}
                className="rounded-lg bg-[#e6f8ef] px-2 py-1 text-xs font-bold text-[#13a961] hover:bg-[#d7f3e5]"
              >
                Approve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Attendance Percentage Indicator
 */
export function AttendancePercentage({
  percentage,
  size = "md"
}: {
  percentage: number;
  size?: "sm" | "md" | "lg";
}) {
  const getColor = (pct: number) => {
    if (pct >= 75) return "text-[#13a961]";
    if (pct >= 60) return "text-[#d79418]";
    return "text-[#ed515d]";
  };

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };

  return (
    <div className={clsx("font-bold", getColor(percentage), sizeClasses[size])}>
      {percentage.toFixed(2)}%
      <p className="text-xs font-medium text-[#7d86a8]">
        {percentage >= 75 ? "Eligible" : percentage >= 60 ? "Moderate" : "Low"}
      </p>
    </div>
  );
}

/**
 * Fee Collection Chart Component
 */
export function FeeCollectionProgressBar({
  paid,
  total,
  concessionAmount = 0
}: {
  paid: number;
  total: number;
  concessionAmount?: number;
}) {
  const percentage = total > 0 ? (paid / total) * 100 : 0;
  const effectiveTotal = total - concessionAmount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-[#303247]">
          ₹{paid.toLocaleString("en-IN")} of ₹{effectiveTotal.toLocaleString("en-IN")}
        </span>
        <span className="font-semibold text-[#7d86a8]">{Math.round(percentage)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#e6e9f5]">
        <div
          className="h-full bg-[#3033a1] transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {concessionAmount > 0 && (
        <p className="text-xs font-medium text-[#7d86a8]">
          Concession: ₹{concessionAmount.toLocaleString("en-IN")}
        </p>
      )}
    </div>
  );
}

/**
 * Payment Method Badge
 */
export function PaymentMethodBadge({
  method
}: {
  method: "cash" | "cheque" | "online" | "transfer" | "upi" | "card" | "bank_transfer";
}) {
  const configs = {
    cash: { bg: "bg-[#e6f8ef]", text: "text-[#13a961]", label: "Cash" },
    cheque: { bg: "bg-[#eeefff]", text: "text-[#3033a1]", label: "Cheque" },
    online: { bg: "bg-[#f0edff]", text: "text-[#5751b8]", label: "Online" },
    transfer: { bg: "bg-[#eeefff]", text: "text-[#3033a1]", label: "Bank Transfer" },
    upi: { bg: "bg-[#f0edff]", text: "text-[#5751b8]", label: "UPI" },
    card: { bg: "bg-[#fff4df]", text: "text-[#d79418]", label: "Card" },
    bank_transfer: { bg: "bg-[#eeefff]", text: "text-[#3033a1]", label: "Bank Transfer" }
  };

  const config = method in configs ? configs[method as keyof typeof configs] : configs.cash;

  return (
    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", config.bg, config.text)}>
      {config.label}
    </span>
  );
}
