/**
 * Admin workspace hooks — TTL-cached fetches over features/admin/api.
 * Mirrors the parent workspace pattern so read cost stays bounded.
 */
import { useCallback, useEffect, useState } from "react";
import { mobileCache } from "@/lib/cache/mobileCache";
import { asDateString, asText } from "@/lib/text";
import {
  fetchCashBook, fetchChangeRequests, fetchDashboardStats, fetchExams, fetchExpenses, fetchFinanceSummary, fetchLeaveRequests, fetchNotices,
  fetchRecentPayments, fetchStaffDirectory, fetchTasks, fetchTeachers, fetchTodayAttendance,
  type AdminPayment, type AdminTeacher, type CashBookEntry, type ChangeRequest, type DashboardStats, type Exam, type Expense, type FinanceSummary,
  type LeaveRequest, type Notice, type StaffDirectory, type StaffTask, type TodayAttendanceSummary
} from "./api";

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };

function useCachedFetch<T>(cacheKey: string, fetcher: () => Promise<T>, ttlMinutes: number) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });

  const load = useCallback(
    async (force = false) => {
      setState((s) => ({ ...s, loading: s.data === null, error: null }));
      try {
        if (!force) {
          const cached = await mobileCache.get<T>(cacheKey);
          if (cached) {
            setState({ data: cached, loading: false, error: null });
            return;
          }
        }
        const fresh = await fetcher();
        await mobileCache.set(cacheKey, fresh, ttlMinutes);
        setState({ data: fresh, loading: false, error: null });
      } catch (err) {
        setState((s) => ({
          ...s,
          loading: false,
          error: err instanceof Error ? err.message : "Unable to load data."
        }));
      }
    },
    // fetcher is stable per call site; cacheKey identifies the resource
    [cacheKey, ttlMinutes] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, refresh: () => load(true) };
}

export function useDashboardStats() {
  const { data, loading, error, refresh } = useCachedFetch<DashboardStats>(
    "admin-dashboard-stats",
    fetchDashboardStats,
    5
  );
  return { stats: data, loading, error, refresh };
}

export function useRecentPayments() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await fetchRecentPayments(10);
      await mobileCache.set("admin-recent-payments-v2", page.payments, 3);
      setPayments(page.payments);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchRecentPayments(10, cursor ?? "");
      setPayments((prev) => [
        ...prev,
        ...page.payments.filter((item) => !prev.some((p) => p.id === item.id))
      ]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Keep the current page; pull-to-refresh retries.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loading, loadingMore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await mobileCache.get<AdminPayment[]>("admin-recent-payments-v2");
        if (cancelled) return;
        if (cached && cached.length > 0) {
          setPayments(cached);
          setHasMore(true);
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to network.
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { payments, loading, loadingMore, hasMore, error, refresh, loadMore };
}

export function useLeaveRequests() {
  const { data, loading, error, refresh } = useCachedFetch<LeaveRequest[]>(
    "admin-leave-requests",
    fetchLeaveRequests,
    2
  );
  return { requests: data ?? [], loading, error, refresh };
}

export function useChangeRequests(status = "pending") {
  const { data, loading, error, refresh } = useCachedFetch<ChangeRequest[]>(
    `admin-change-requests-${status}`,
    () => fetchChangeRequests(status),
    2
  );
  return { changes: data ?? [], loading, error, refresh };
}

export function useTasks(teacherId = "") {
  const { data, loading, error, refresh } = useCachedFetch<StaffTask[]>(
    `admin-tasks-${teacherId || "all"}`,
    () => fetchTasks(teacherId),
    2
  );
  return { tasks: data ?? [], loading, error, refresh };
}

export function useNotices() {
  const { data, loading, error, refresh } = useCachedFetch<Notice[]>(
    "admin-notices-v2",
    fetchNotices,
    10
  );
  return { notices: data ?? [], loading, error, refresh };
}

export function useStaff() {
  const { data, loading, error, refresh } = useCachedFetch<AdminTeacher[]>(
    "admin-teachers",
    () => fetchTeachers(50),
    15
  );
  return { staff: data ?? [], loading, error, refresh };
}

export function useStaffDirectory() {
  const { data, loading, error, refresh } = useCachedFetch<StaffDirectory>(
    "admin-staff-directory",
    fetchStaffDirectory,
    15
  );
  return {
    teachers: data?.teachers ?? [],
    drivers: data?.drivers ?? [],
    office: data?.office ?? [],
    loading,
    error,
    refresh
  };
}

export function useFinanceSummary() {
  const { data, loading, error, refresh } = useCachedFetch<FinanceSummary>(
    "admin-finance-summary",
    fetchFinanceSummary,
    5
  );
  return { summary: data, loading, error, refresh };
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const page = await fetchExpenses(30);
      await mobileCache.set("admin-expenses", page.expenses, 5);
      setExpenses(page.expenses);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load expenses.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchExpenses(30, cursor ?? "");
      setExpenses((prev) => [
        ...prev,
        ...page.expenses.filter((item) => !prev.some((p) => p.id === item.id))
      ]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Keep the list; the user can retry via pull-to-refresh.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, hasMore, loading, loadingMore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cached = await mobileCache.get<Expense[]>("admin-expenses");
        if (cancelled) return;
        if (cached && cached.length > 0) {
          setExpenses(cached);
          setHasMore(true);
          setLoading(false);
          return;
        }
      } catch {
        // Fall through to network.
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { expenses, loading, loadingMore, hasMore, error, refresh, loadMore };
}

export function useCashBook() {
  const { data, loading, error, refresh } = useCachedFetch<{ entries: CashBookEntry[]; closingBalance: number }>(
    "admin-cashbook",
    fetchCashBook,
    5
  );
  return { entries: data?.entries ?? [], closingBalance: data?.closingBalance ?? 0, loading, error, refresh };
}

export function useExams() {
  const { data, loading, error, refresh } = useCachedFetch<Exam[]>(
    "admin-exams",
    () => fetchExams(),
    10
  );
  return { exams: data ?? [], loading, error, refresh };
}

export function useTodayAttendance() {
  const { data, loading, error, refresh } = useCachedFetch<TodayAttendanceSummary>(
    "admin-today-attendance-v2",
    fetchTodayAttendance,
    3
  );
  return {
    present: data?.present ?? 0,
    total: data?.total ?? 0,
    late: data?.late ?? 0,
    absent: data?.absent ?? 0,
    loading,
    error,
    refresh
  };
}

/* ------------------------------------------------------------- formatting */

export function formatMoney(value?: number) {
  const amount = Number(value ?? 0);
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Compact money for stat tiles: ₹1.5L, ₹42K. */
export function formatMoneyShort(value?: number) {
  const amount = Number(value ?? 0);
  if (amount >= 10_000_000) return `₹${(amount / 10_000_000).toFixed(1)}Cr`;
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000) return `₹${Math.round(amount / 1_000)}K`;
  return `₹${amount}`;
}

export function formatDate(value?: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  // Firestore Timestamps (live instances or {_seconds} JSON) must become
  // text here — returning the raw value crashes the render (error #31).
  if (typeof value !== "string") {
    const converted = asDateString(value, "");
    return converted || "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Non-string display values become safe text (never an object child). */
export function formatText(value: unknown, fallback = "—"): string {
  const text = asText(value);
  return text || fallback;
}

/** "karthik · 10 A" — student name with class beside it for payment rows. */
export function paymentStudentLine(payment: {
  studentName?: string;
  class?: string;
  section?: string;
}): string {
  const name = formatText(payment.studentName, "Payment");
  const cls = [asText(payment.class), asText(payment.section)].filter(Boolean).join(" ");
  return cls ? `${name} · ${cls}` : name;
}

/** One row in the all-transactions timeline: fee income (green) or expense (red). */
export type TxnRow = {
  id: string;
  kind: "income" | "expense";
  title: string;
  subtitle: string;
  amount: number;
  dateValue: number;
  dateLabel: string;
  /** Present for fee income — opens the receipt detail screen. */
  paymentId?: string;
};

function txnDateValue(value: unknown): number {
  const text = asDateString(value, "");
  const parsed = new Date(text || String(value ?? "")).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Merge fee payments + expenses into one newest-first timeline.
 * `filter` matches the Cash/Online chips against each row's method.
 */
export function buildTransactions(
  payments: AdminPayment[],
  expenses: Expense[],
  filter = "All"
): TxnRow[] {
  const match = (method?: string) =>
    filter === "All" || (method ?? "").toLowerCase() === filter.toLowerCase();
  const rows: TxnRow[] = [];
  for (const p of payments) {
    if (!match(p.paymentMethod)) continue;
    rows.push({
      id: `income-${p.id}`,
      kind: "income",
      title: paymentStudentLine(p),
      subtitle: asText(p.paymentMethod) || "—",
      amount: Number(p.amountPaid ?? 0),
      dateValue: txnDateValue(p.createdAt),
      dateLabel: formatDate(p.createdAt),
      paymentId: p.id
    });
  }
  for (const e of expenses) {
    if (!match(e.paymentMethod)) continue;
    rows.push({
      id: `expense-${e.id}`,
      kind: "expense",
      title: formatText(e.vendor || e.description, "Expense"),
      subtitle: formatText(e.category, "Expense"),
      amount: Number(e.amount ?? 0),
      dateValue: txnDateValue(e.date ?? e.createdAt),
      dateLabel: formatDate(e.date ?? e.createdAt)
    });
  }
  rows.sort((a, b) => b.dateValue - a.dateValue);
  return rows;
}
