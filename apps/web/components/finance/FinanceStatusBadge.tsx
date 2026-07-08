"use client";

import { formatLabel } from "@sri-narayana/shared";

export function MethodBadge({ method }: { method?: string }) {
  if (!method) return <span className="text-[#94a3b8]">—</span>;
  const styles: Record<string, string> = {
    cash: "bg-[#f0fdf4] text-[#16a34a]",
    upi: "bg-[#eff6ff] text-[#2563eb]",
    bank_transfer: "bg-[#eff6ff] text-[#2563eb]",
    bank: "bg-[#eff6ff] text-[#2563eb]",
    cheque: "bg-[#fffbeb] text-[#d97706]",
    card: "bg-[#f0fdf4] text-[#16a34a]"
  };
  const key = method.toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[key] || "bg-[#f1f5f9] text-[#64748b]"}`}>
      {key === "upi" ? "UPI" : formatLabel(method)}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-[#94a3b8]">—</span>;
  const styles: Record<string, string> = {
    completed: "bg-[#f0fdf4] text-[#16a34a]",
    paid: "bg-[#f0fdf4] text-[#16a34a]",
    approved: "bg-[#f0fdf4] text-[#16a34a]",
    pending: "bg-[#fffbeb] text-[#d97706]",
    failed: "bg-[#fef2f2] text-[#dc2626]",
    cancelled: "bg-[#f1f5f9] text-[#94a3b8]",
    rejected: "bg-[#fef2f2] text-[#dc2626]"
  };
  const key = status.toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[key] || "bg-[#f1f5f9] text-[#64748b]"}`}>
      {formatLabel(status)}
    </span>
  );
}

export function TypeBadge({ type }: { type?: string }) {
  if (!type) return <span className="text-[#94a3b8]">—</span>;
  const styles: Record<string, string> = {
    income: "bg-[#f0fdf4] text-[#16a34a]",
    expense: "bg-[#fef2f2] text-[#dc2626]",
    invoice: "bg-[#eff6ff] text-[#2563eb]",
    refund: "bg-[#fffbeb] text-[#d97706]",
    payment: "bg-[#eff6ff] text-[#2563eb]"
  };
  const key = type.toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${styles[key] || "bg-[#f1f5f9] text-[#64748b]"}`}>
      {formatLabel(type)}
    </span>
  );
}
