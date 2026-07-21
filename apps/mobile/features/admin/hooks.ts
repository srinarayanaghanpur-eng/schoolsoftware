/**
 * Admin workspace hooks — TTL-cached fetches over features/admin/api.
 * Mirrors the parent workspace pattern so read cost stays bounded.
 */
import { useCallback, useEffect, useState } from "react";
import { mobileCache } from "@/lib/cache/mobileCache";
import {
  fetchDashboardStats, fetchFinanceSummary, fetchLeaveRequests, fetchNotices,
  fetchRecentPayments, fetchTeachers, fetchTodayAttendance,
  type AdminPayment, type AdminTeacher, type DashboardStats, type FinanceSummary,
  type LeaveRequest, type Notice
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
  const { data, loading, error, refresh } = useCachedFetch<AdminPayment[]>(
    "admin-recent-payments",
    () => fetchRecentPayments(10),
    3
  );
  return { payments: data ?? [], loading, error, refresh };
}

export function useLeaveRequests() {
  const { data, loading, error, refresh } = useCachedFetch<LeaveRequest[]>(
    "admin-leave-requests",
    fetchLeaveRequests,
    2
  );
  return { requests: data ?? [], loading, error, refresh };
}

export function useNotices() {
  const { data, loading, error, refresh } = useCachedFetch<Notice[]>(
    "admin-notices",
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

export function useFinanceSummary() {
  const { data, loading, error, refresh } = useCachedFetch<FinanceSummary>(
    "admin-finance-summary",
    fetchFinanceSummary,
    5
  );
  return { summary: data, loading, error, refresh };
}

export function useTodayAttendance() {
  const { data, loading, error, refresh } = useCachedFetch(
    "admin-today-attendance",
    fetchTodayAttendance,
    3
  );
  const records = data?.records ?? [];
  const teachers = data?.teachers ?? [];
  const present = records.filter((r) => r.status === "present" || r.status === "late").length;
  return {
    present,
    total: teachers.length,
    late: records.filter((r) => r.status === "late").length,
    absent: Math.max(0, teachers.length - present),
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

export function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
