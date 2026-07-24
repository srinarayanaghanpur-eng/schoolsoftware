// Pure aggregation helpers for the Finance Dashboard summary cards.
// These operate on plain objects (already-fetched Firestore doc data) so they
// can be unit-tested without Firestore and never trigger extra reads.

export type MethodTotal = { method: string; amount: number };
export type ClassDue = { className: string; total: number; dueCount: number; dueAmount: number };
export type CategoryTotal = { category: string; amount: number };

/** Safely convert "₹35,000", "35000", 35000, or Firestore numbers to a number. */
export function toNumberSafe(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/[₹,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Pick the paid amount from any of the known field names. */
export function pickAmount(data: Record<string, unknown>): number {
  for (const field of ["amountPaid", "paidAmount", "amount"]) {
    const v = toNumberSafe(data[field]);
    if (v > 0) return v;
  }
  return 0;
}

/** Pick the payment method from any of the known field names. */
export function pickMethod(data: Record<string, unknown>): string {
  for (const field of ["paymentMethod", "method", "paymentMode", "mode"]) {
    const v = data[field];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

/** Case-insensitive canonical method label. */
export function normalizeMethod(raw: string): string {
  const m = String(raw || "").trim().toLowerCase();
  if (!m) return "Other";
  if (m === "cash") return "Cash";
  if (["upi", "gpay", "phonepe", "paytm"].includes(m)) return "UPI";
  if (["online", "bank transfer", "bank", "neft", "imps", "rtgs", "netbanking", "net banking"].includes(m)) return "Online/Bank";
  if (["card", "debit card", "credit card"].includes(m)) return "Card";
  if (["cheque", "check", "dd"].includes(m)) return "Cheque";
  return "Other";
}

const COMPLETED = new Set(["completed", "paid", "success", "succeeded", "approved"]);
const EXCLUDED = new Set(["cancelled", "canceled", "failed", "rejected", "refunded", "deleted", "pending"]);

/** Normalized "counts as completed income" check (completed/Completed/paid/...). */
export function isCompletedStatus(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return true; // legacy records without status were recorded as collected
  if (EXCLUDED.has(s)) return false;
  return COMPLETED.has(s);
}

export function isApprovedExpense(status: unknown): boolean {
  const s = String(status ?? "").trim().toLowerCase();
  return ["approved", "completed", "paid"].includes(s);
}

/**
 * Group completed payments by normalized method.
 * Dedupes by doc id when provided, so a record never counts twice.
 */
export function aggregateCollectionByMethod(
  payments: Array<{ id?: string; data: Record<string, unknown> }>
): MethodTotal[] {
  const seen = new Set<string>();
  const totals = new Map<string, number>();
  for (const p of payments) {
    if (p.id) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
    }
    if (!isCompletedStatus(p.data.status)) continue;
    const amount = pickAmount(p.data);
    if (amount <= 0) continue;
    const method = normalizeMethod(pickMethod(p.data));
    totals.set(method, (totals.get(method) ?? 0) + amount);
  }
  return Array.from(totals, ([method, amount]) => ({ method, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Group positive dues by class from studentFeeSummaries docs.
 * - Excludes fully paid students (dueAmount <= 0) and deleted/inactive records.
 * - Dedupes by studentId so duplicate summary docs are not double-counted.
 * - Class name resolved from className/classId/classApplied/grade, optionally
 *   mapped through the classes collection (id → name).
 */
export function aggregateDuesByClass(
  summaries: Array<{ id?: string; data: Record<string, unknown> }>,
  classNamesById?: Map<string, string>
): ClassDue[] {
  const seenStudents = new Set<string>();
  const byClass = new Map<string, ClassDue>();
  for (const s of summaries) {
    const d = s.data;
    if (d.deleted === true || d.active === false || d.isDeleted === true) continue;
    const studentKey = String(d.studentId || s.id || "");
    if (studentKey) {
      if (seenStudents.has(studentKey)) continue;
      seenStudents.add(studentKey);
    }
    const rawClass = String(d.className || d.classId || d.classApplied || d.grade || "Unknown");
    const className = classNamesById?.get(rawClass) ?? rawClass;
    // due = assigned fee − concessions − completed payments, but prefer the
    // precomputed dueAmount kept in sync by recalculateStudentFeeSummary.
    const due = d.dueAmount !== undefined
      ? toNumberSafe(d.dueAmount)
      : Math.max(0, toNumberSafe(d.totalFee) - toNumberSafe(d.totalConcession) - toNumberSafe(d.totalPaid));
    const row = byClass.get(className) ?? { className, total: 0, dueCount: 0, dueAmount: 0 };
    row.total += 1;
    if (due > 0) {
      row.dueCount += 1;
      row.dueAmount += due;
    }
    byClass.set(className, row);
  }
  return Array.from(byClass.values())
    .filter((c) => c.dueCount > 0)
    .sort((a, b) => b.dueAmount - a.dueAmount);
}

/** Group approved/completed expenses by category. */
export function aggregateExpenseBreakdown(
  expenses: Array<{ id?: string; data: Record<string, unknown> }>
): CategoryTotal[] {
  const seen = new Set<string>();
  const totals = new Map<string, number>();
  for (const e of expenses) {
    if (e.id) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
    }
    if (!isApprovedExpense(e.data.status)) continue;
    const amount = toNumberSafe(e.data.amount);
    if (amount <= 0) continue;
    const category = String(e.data.category || "other");
    totals.set(category, (totals.get(category) ?? 0) + amount);
  }
  return Array.from(totals, ([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
