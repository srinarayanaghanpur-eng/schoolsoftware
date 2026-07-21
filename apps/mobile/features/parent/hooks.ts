/**
 * Parent workspace hooks — cached fetch with TTL via lib/cache/mobileCache.
 * One summary fetch feeds Home, Messages (notices) and Profile, keeping
 * Firestore reads to the server-aggregated minimum.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { mobileCache } from "@/lib/cache/mobileCache";
import {
  fetchHomework,
  fetchSummary,
  type PortalHomework,
  type PortalStudent,
  type PortalSummary
} from "./api";

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };

const SUMMARY_TTL_MIN = 5;
const HOMEWORK_TTL_MIN = 10;

export function useParentSummary(studentId?: string) {
  const [state, setState] = useState<AsyncState<{ summary: PortalSummary; linkedStudents: PortalStudent[] }>>({
    data: null,
    loading: true,
    error: null
  });

  const load = useCallback(async (force = false) => {
    const cacheKey = `portal-summary:${studentId ?? "default"}`;
    setState((s) => ({ ...s, loading: s.data === null, error: null }));
    try {
      if (!force) {
        const cached = await mobileCache.get<{ summary: PortalSummary; linkedStudents: PortalStudent[] }>(cacheKey);
        if (cached) {
          setState({ data: cached, loading: false, error: null });
          return;
        }
      }
      const fresh = await fetchSummary(studentId);
      await mobileCache.set(cacheKey, fresh, SUMMARY_TTL_MIN);
      setState({ data: fresh, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        data: s.data,
        loading: false,
        error: err instanceof Error ? err.message : "Unable to load. Check your connection."
      }));
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  return useMemo(() => ({
    summary: state.data?.summary ?? null,
    linkedStudents: state.data?.linkedStudents ?? [],
    loading: state.loading,
    error: state.error,
    refresh: () => load(true)
  }), [state, load]);
}

export function useParentHomework(studentId?: string) {
  const [state, setState] = useState<AsyncState<PortalHomework[]>>({ data: null, loading: true, error: null });

  const load = useCallback(async (force = false) => {
    if (!studentId) return;
    const cacheKey = `portal-homework:${studentId}`;
    setState((s) => ({ ...s, loading: s.data === null, error: null }));
    try {
      if (!force) {
        const cached = await mobileCache.get<PortalHomework[]>(cacheKey);
        if (cached) {
          setState({ data: cached, loading: false, error: null });
          return;
        }
      }
      const fresh = await fetchHomework(studentId);
      await mobileCache.set(cacheKey, fresh.homework, HOMEWORK_TTL_MIN);
      setState({ data: fresh.homework, loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        data: s.data,
        loading: false,
        error: err instanceof Error ? err.message : "Unable to load homework."
      }));
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  return useMemo(() => ({
    homework: state.data ?? [],
    loading: state.loading && studentId !== undefined,
    error: state.error,
    refresh: () => load(true)
  }), [state, load, studentId]);
}

/* ---------------- display helpers (pure) ---------------- */

const SUBJECT_STYLES: Array<{ match: RegExp; code: string }> = [
  { match: /math/i, code: "MATH" },
  { match: /sci|phys|chem|bio/i, code: "SCI" },
  { match: /eng/i, code: "ENG" },
  { match: /hin/i, code: "HIN" },
  { match: /soc|hist|geo/i, code: "SOC" },
  { match: /tel/i, code: "TEL" }
];

export function subjectCode(subject: string): string {
  const hit = SUBJECT_STYLES.find((s) => s.match.test(subject));
  return hit?.code ?? subject.slice(0, 4).toUpperCase();
}

export function formatDue(dueDate?: string): { label: string; overdue: boolean } {
  if (!dueDate) return { label: "No due date", overdue: false };
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return { label: dueDate, overdue: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return { label: "Overdue", overdue: true };
  if (diffDays === 0) return { label: "Due today", overdue: false };
  if (diffDays === 1) return { label: "Due tomorrow", overdue: false };
  return { label: `Due ${due.toLocaleDateString(undefined, { weekday: "short" })}`, overdue: false };
}

export function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
