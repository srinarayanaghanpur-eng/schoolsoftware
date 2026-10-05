/**
 * Parent workspace hooks — cached fetch with TTL via lib/cache/mobileCache.
 * One summary fetch feeds Home, Messages (notices) and Profile, keeping
 * Firestore reads to the server-aggregated minimum.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { mobileCache } from "@/lib/cache/mobileCache";
import { asDateString, asText } from "@/lib/text";
import {
  fetchAttendance,
  fetchHomework,
  fetchPayments,
  fetchSummary,
  type PortalAttendanceResponse,
  type PortalHomework,
  type PortalPaymentFull,
  type PortalStudent,
  type PortalSummary
} from "./api";

type AsyncState<T> = { data: T | null; loading: boolean; error: string | null };

const SUMMARY_TTL_MIN = 5;
const HOMEWORK_TTL_MIN = 10;
const PAYMENTS_TTL_MIN = 5;
const ATTENDANCE_TTL_MIN = 10;

type SummaryPayload = { summary: PortalSummary; linkedStudents: PortalStudent[] };

/**
 * Guarantee every field screens touch. The server sends full shapes today,
 * but cached payloads from older builds (or a partial backend response)
 * must never crash a render — missing pieces become safe empties.
 */
function normalizeSummaryPayload(input: SummaryPayload | null): SummaryPayload | null {
  if (!input) return null;
  const s = (input.summary ?? {}) as Partial<PortalSummary>;
  const student = (s.student ?? {}) as Partial<PortalStudent>;
  const fees = (s.fees ?? {}) as Partial<PortalSummary["fees"]>;
  return {
    summary: {
      student: {
        id: asText(student.id),
        name: asText(student.name),
        className: asText(student.className),
        section: asText(student.section),
        admissionNo: asText(student.admissionNo)
      },
      fees: {
        total: Number(fees.total ?? 0),
        paid: Number(fees.paid ?? 0),
        due: Number(fees.due ?? 0),
        feeBalanceCarriedForward: Number(fees.feeBalanceCarriedForward ?? 0),
        ...(typeof fees.status === "string" ? { status: fees.status } : {})
      },
      marks: Array.isArray(s.marks) ? s.marks : [],
      notices: Array.isArray(s.notices)
        ? s.notices.map((notice) => {
            const n = (notice ?? {}) as Record<string, unknown>;
            return {
              title: asText(n.title, "Notice"),
              body: asText(n.body),
              createdAt: typeof n.createdAt === "string" ? n.createdAt : undefined
            };
          })
        : [],
      recentPayments: Array.isArray(s.recentPayments) ? s.recentPayments.map(normalizePaymentLike) : [],
      upcomingHolidays: Array.isArray(s.upcomingHolidays)
        ? s.upcomingHolidays.map((holiday) => {
            const h = (holiday ?? {}) as Record<string, unknown>;
            return {
              title: asText(h.title, "Holiday"),
              date: asDateString(h.date),
              type: asText(h.type, "holiday")
            };
          })
        : []
    },
    linkedStudents: Array.isArray(input.linkedStudents)
      ? input.linkedStudents.map((child) => {
          const c = (child ?? {}) as Partial<PortalStudent>;
          return {
            id: asText(c.id),
            name: asText(c.name),
            className: asText(c.className),
            section: asText(c.section),
            admissionNo: asText(c.admissionNo)
          };
        })
      : []
  };
}

/** Shared payment shape scrub — every rendered field becomes safe text. */
function normalizePaymentLike(payment: unknown): PortalPaymentFull {
  const p = (payment ?? {}) as Record<string, unknown>;
  return {
    id: asText(p.id),
    amountPaid: Number(p.amountPaid ?? 0),
    paymentType: asText(p.paymentType),
    paymentMethod: asText(p.paymentMethod),
    transactionId: asText(p.transactionId),
    status: asText(p.status, "completed"),
    receiptNumber: asText(p.receiptNumber),
    createdAt: asDateString(p.createdAt) || asText(p.createdAt)
  };
}

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
          setState({ data: normalizeSummaryPayload(cached), loading: false, error: null });
          return;
        }
      }
      const fresh = await fetchSummary(studentId);
      await mobileCache.set(cacheKey, fresh, SUMMARY_TTL_MIN);
      setState({ data: normalizeSummaryPayload(fresh), loading: false, error: null });
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
      setState({ data: normalizeHomeworkList(fresh.homework), loading: false, error: null });
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

export function useParentPayments(studentId?: string) {  const [state, setState] = useState<AsyncState<PortalPaymentFull[]>>({ data: null, loading: true, error: null });

  const load = useCallback(async (force = false) => {
    const cacheKey = `portal-payments:${studentId ?? "default"}`;
    setState((s) => ({ ...s, loading: s.data === null, error: null }));
    try {
      if (!force) {
        const cached = await mobileCache.get<PortalPaymentFull[]>(cacheKey);
        if (cached !== null) {
          setState({ data: cached.map(normalizePaymentLike), loading: false, error: null });
          return;
        }
      }
      const fresh = await fetchPayments(studentId);
      await mobileCache.set(cacheKey, fresh.payments, PAYMENTS_TTL_MIN);
      setState({ data: fresh.payments.map(normalizePaymentLike), loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        data: s.data,
        loading: false,
        error: err instanceof Error ? err.message : "Unable to load payments."
      }));
    }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  return useMemo(() => ({
    payments: state.data ?? [],
    loading: state.loading,
    error: state.error,
    refresh: () => load(true)
  }), [state, load]);
}

export function useParentAttendance(studentId?: string, month?: string) {
  const [state, setState] = useState<AsyncState<PortalAttendanceResponse>>({
    data: null,
    loading: true,
    error: null
  });

  const load = useCallback(async (force = false) => {
    if (!studentId) return;
    const monthKey = month ?? "current";
    const cacheKey = `portal-attendance:${studentId}:${monthKey}`;
    setState((s) => ({ ...s, loading: s.data === null, error: null }));
    try {
      if (!force) {
        const cached = await mobileCache.get<PortalAttendanceResponse>(cacheKey);
        if (cached !== null) {
          setState({ data: normalizeAttendanceRecord(cached), loading: false, error: null });
          return;
        }
      }
      const fresh = await fetchAttendance(studentId, month);
      await mobileCache.set(cacheKey, fresh, ATTENDANCE_TTL_MIN);
      setState({ data: normalizeAttendanceRecord(fresh), loading: false, error: null });
    } catch (err) {
      setState((s) => ({
        data: s.data,
        loading: false,
        error: err instanceof Error ? err.message : "Unable to load attendance."
      }));
    }
  }, [studentId, month]);

  useEffect(() => { void load(); }, [load]);

  return useMemo(() => ({
    record: state.data,
    loading: state.loading && studentId !== undefined,
    error: state.error,
    refresh: () => load(true)
  }), [state, load, studentId]);
}

/** Homework list scrub — titles/bodies/dates become safe text. */
function normalizeHomeworkList(items: PortalHomework[]): PortalHomework[] {
  return items.map((item) => {
    const hw = (item ?? {}) as Record<string, unknown>;
    return {
      id: asText(hw.id),
      title: asText(hw.title, "Homework"),
      subject: asText(hw.subject),
      description: asText(hw.description) || undefined,
      dueDate: asDateString(hw.dueDate) || asText(hw.dueDate) || undefined,
      assignedDate: asDateString(hw.assignedDate) || asText(hw.assignedDate) || undefined
    };
  });
}

/** Same guarantee as normalizeSummaryPayload, for the attendance record. */
function normalizeAttendanceRecord(input: PortalAttendanceResponse | null): PortalAttendanceResponse | null {
  if (!input) return null;
  const summary = (input.summary ?? {}) as Partial<PortalAttendanceResponse["summary"]>;
  return {
    student: input.student,
    summary: {
      present: Number(summary.present ?? 0),
      absent: Number(summary.absent ?? 0),
      late: Number(summary.late ?? 0),
      total: Number(summary.total ?? 0),
      percentage: Number(summary.percentage ?? 0)
    },
    attendance: Array.isArray(input.attendance)
      ? input.attendance.map((day) => {
          const d = (day ?? {}) as Record<string, unknown>;
          return {
            id: asText(d.id),
            date: asDateString(d.date) || asText(d.date),
            status: asText(d.status),
            checkIn: asText(d.checkIn) || undefined,
            checkOut: asText(d.checkOut) || undefined
          };
        })
      : []
  };
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

/** Shift a YYYY-MM month key by delta months (pure, for month navigation). */
export function shiftMonth(month: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const base = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date();
  if (Number.isNaN(base.getTime())) return new Date().toISOString().slice(0, 7);
  base.setMonth(base.getMonth() + delta);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "September 2026" for screen headings. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
