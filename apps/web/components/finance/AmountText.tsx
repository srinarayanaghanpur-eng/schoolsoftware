"use client";

export function formatINR(amount?: number | string | null): string {
  const n = typeof amount === "string" ? parseFloat(amount) : Number(amount ?? 0);
  if (!Number.isFinite(n) || n < 0) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatSafeDate(date?: string | Date | null): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}

export function formatPersonName(name?: string | null): string {
  if (!name) return "—";
  return name.replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function AmountText({ amount, className = "" }: { amount?: number | string | null; className?: string }) {
  return <span className={`font-semibold ${className}`}>{formatINR(amount)}</span>;
}
