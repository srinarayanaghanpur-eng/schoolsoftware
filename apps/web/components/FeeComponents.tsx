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
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      icon: CheckCircle2
    },
    rejected: {
      bg: "bg-red-100",
      text: "text-red-700",
      icon: XCircle
    },
    pending: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      icon: Clock
    },
    completed: {
      bg: "bg-blue-100",
      text: "text-blue-700",
      icon: CheckCircle2
    },
    pending_payment: {
      bg: "bg-orange-100",
      text: "text-orange-700",
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
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600"
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm border border-stone-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-stone-500 font-medium">{title}</p>
          <p className="mt-2 text-3xl font-bold text-stone-900">
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
        <div className={clsx("rounded-lg p-3", colorClasses[color])}>
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
    <div className="rounded-lg bg-white p-4 border border-stone-200 hover:shadow-md transition">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
        <div>
          <p className="text-xs text-stone-500 font-medium">Student</p>
          <p className="mt-1 text-sm font-semibold text-stone-900">{concession.studentName}</p>
          <p className="text-xs text-stone-500">{concession.admissionNumber}</p>
        </div>
        <div>
          <p className="text-xs text-stone-500 font-medium">Class/Section</p>
          <p className="mt-1 text-sm text-stone-900">{getClassDisplayName(concession.class)}/{concession.section}</p>
        </div>
        <div>
          <p className="text-xs text-stone-500 font-medium">Type & Amount</p>
          <p className="mt-1 text-sm text-stone-900">
            {concession.concessionType === "percentage"
              ? `${concession.concessionPercent}%`
              : `₹${concession.concessionAmount}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-stone-500 font-medium">Status</p>
          <div className="mt-1">
            <FeeStatusBadge status={concession.status} size="sm" />
          </div>
        </div>
        <div>
          <p className="text-xs text-stone-500 font-medium">Actions</p>
          <div className="mt-1 flex gap-2">
            {onView && (
              <button
                onClick={onView}
                className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
              >
                View
              </button>
            )}
            {concession.status === "pending" && onEdit && (
              <button
                onClick={onEdit}
                className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-600 hover:bg-amber-100"
              >
                Edit
              </button>
            )}
            {concession.status === "pending" && onApprove && (
              <button
                onClick={onApprove}
                className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
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
    if (pct >= 75) return "text-emerald-600";
    if (pct >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const sizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg"
  };

  return (
    <div className={clsx("font-semibold", getColor(percentage), sizeClasses[size])}>
      {percentage.toFixed(2)}%
      <p className="text-xs text-stone-500 font-normal">
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
        <span className="font-medium text-stone-900">
          ₹{paid.toLocaleString("en-IN")} of ₹{effectiveTotal.toLocaleString("en-IN")}
        </span>
        <span className="text-stone-500">{Math.round(percentage)}%</span>
      </div>
      <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-emerald-500 h-full transition-all duration-300"
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {concessionAmount > 0 && (
        <p className="text-xs text-stone-500">
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
  method: "cash" | "cheque" | "online" | "transfer";
}) {
  const configs = {
    cash: { bg: "bg-green-100", text: "text-green-700", label: "Cash" },
    cheque: { bg: "bg-blue-100", text: "text-blue-700", label: "Cheque" },
    online: { bg: "bg-purple-100", text: "text-purple-700", label: "Online" },
    transfer: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Transfer" }
  };

  const config = configs[method];

  return (
    <span className={clsx("inline-flex rounded-full px-3 py-1 text-xs font-semibold", config.bg, config.text)}>
      {config.label}
    </span>
  );
}
