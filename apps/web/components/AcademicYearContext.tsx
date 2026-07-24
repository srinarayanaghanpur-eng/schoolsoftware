"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AcademicYear } from "@sri-narayana/shared";
import { hasPermission } from "@sri-narayana/shared";
import { isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { AdminApiError, adminApiRequest } from "@/lib/adminApiClient";
import { useAdminSession } from "@/components/AdminSessionContext";

type AcademicYearContextValue = {
  years: AcademicYear[];
  activeYear: AcademicYear | null;
  /** The per-login selected year (chosen on the login screen). Pages should
   * scope their queries to this, not to activeYear. */
  selectedYear: AcademicYear | null;
  selectedYearId: string | null;
  setSelectedYear: (id: string) => void;
  loading: boolean;
  error: string | null;
  accessDenied: boolean;
  refreshYears: (options?: { force?: boolean }) => Promise<void>;
  activateYear: (id: string) => Promise<void>;
};

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null);
const ACADEMIC_YEARS_CLIENT_CACHE_MS = 5 * 60 * 1000;
const ACADEMIC_YEARS_CLIENT_CACHE_KEY = "sriNarayana.academicYears";
const ACADEMIC_YEARS_FETCHED_SESSION_KEY = "sriNarayana.academicYearsFetched";
const ACTIVE_ACADEMIC_YEAR_STORAGE_KEY = "sriNarayana.activeAcademicYearId";
const ACADEMIC_YEARS_TIMEOUT_MS = 5_000;
export const SELECTED_ACADEMIC_YEAR_STORAGE_KEY = "sriNarayana.selectedAcademicYear";

function readStoredSelectedYearId(): string | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_ACADEMIC_YEAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed.id === "string" && parsed.id ? parsed.id : null;
  } catch {
    return null;
  }
}

function readCachedAcademicYears(): { years: AcademicYear[]; fresh: boolean } | null {
  try {
    const raw = window.localStorage.getItem(ACADEMIC_YEARS_CLIENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { years?: AcademicYear[]; cachedAt?: number; expiresAt?: number };
    if (!Array.isArray(parsed.years)) {
      window.localStorage.removeItem(ACADEMIC_YEARS_CLIENT_CACHE_KEY);
      return null;
    }
    const expiresAt = parsed.expiresAt ?? (parsed.cachedAt ? parsed.cachedAt + ACADEMIC_YEARS_CLIENT_CACHE_MS : 0);
    return { years: parsed.years, fresh: Boolean(expiresAt && expiresAt > Date.now()) };
  } catch {
    return null;
  }
}

function cacheAcademicYears(years: AcademicYear[]) {
  try {
    const active = years.find((year) => year.isActive);
    window.localStorage.setItem(
      ACADEMIC_YEARS_CLIENT_CACHE_KEY,
      JSON.stringify({ years, cachedAt: Date.now(), expiresAt: Date.now() + ACADEMIC_YEARS_CLIENT_CACHE_MS })
    );
    if (active?.id) window.localStorage.setItem(ACTIVE_ACADEMIC_YEAR_STORAGE_KEY, active.id);
  } catch {
    // Storage can be blocked; server-side caching still reduces duplicate reads.
  }
}

function hasFetchedYearsThisSession() {
  try {
    return window.sessionStorage.getItem(ACADEMIC_YEARS_FETCHED_SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

function markFetchedYearsThisSession() {
  try {
    window.sessionStorage.setItem(ACADEMIC_YEARS_FETCHED_SESSION_KEY, "true");
  } catch {
    // ignore
  }
}

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { role } = useAdminSession();
  const [years, setYears] = useState<AcademicYear[]>(() =>
    typeof window === "undefined" ? [] : readCachedAcademicYears()?.years ?? []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [selectedYearId, setSelectedYearId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredSelectedYearId()
  );

  const activeYear = useMemo(() => years.find((year) => year.isActive) ?? null, [years]);
  // Fall back to the active year when nothing was selected at login (e.g.
  // remembered sessions or roles that skip the login dropdown).
  const selectedYear = useMemo(
    () => (selectedYearId ? years.find((year) => year.id === selectedYearId) ?? null : null) ?? activeYear,
    [years, selectedYearId, activeYear]
  );

  const setSelectedYear = useCallback(
    (id: string) => {
      setSelectedYearId(id);
      try {
        const year = years.find((item) => item.id === id);
        window.localStorage.setItem(
          SELECTED_ACADEMIC_YEAR_STORAGE_KEY,
          JSON.stringify({ id, name: year?.name ?? "" })
        );
      } catch {
        // localStorage may be unavailable; in-memory selection still applies.
      }
    },
    [years]
  );

  const refreshYears = useCallback(async (options?: { force?: boolean }) => {
    if (!isFirebaseConfigured) {
      setYears([]);
      setLoading(false);
      setError("Firebase web config is required to load academic years.");
      return;
    }

    const cachedYears = !options?.force ? readCachedAcademicYears() : null;
    if (cachedYears) {
      setYears(cachedYears.years);
      setError(null);
      setAccessDenied(false);

      if (hasFetchedYearsThisSession()) {
        setLoading(false);
        return;
      }
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), ACADEMIC_YEARS_TIMEOUT_MS);

    setLoading(!cachedYears);
    setError(null);
    setAccessDenied(false);
    try {
      const path = options?.force ? "/api/admin/academic-years?refresh=1" : "/api/admin/academic-years";
      const result = await adminApiRequest<{ ok: true; years: AcademicYear[] }>(path, { signal: controller.signal });
      setYears(result.years);
      cacheAcademicYears(result.years);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 403) {
        setAccessDenied(true);
        setError("Access denied");
      } else if (cachedYears?.years.length) {
        setYears(cachedYears.years);
        setError("Online sync is slow. Using cached data.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to load academic years");
      }
    } finally {
      window.clearTimeout(timeout);
      controller.abort();
      markFetchedYearsThisSession();
      setLoading(false);
    }
  }, []);

  const activateYear = useCallback(
    async (id: string) => {
      await adminApiRequest<{ ok: true }>(`/api/admin/academic-years/${id}/activate`, { method: "POST" });
      await refreshYears({ force: true });
    },
    [refreshYears]
  );

  useEffect(() => {
    if (role && hasPermission(role, "academic_years.view")) {
      void refreshYears();
    } else {
      setYears([]);
      setLoading(false);
      setError(null);
      setAccessDenied(false);
    }
  }, [refreshYears, role]);

  return (
    <AcademicYearContext.Provider
      value={{ years, activeYear, selectedYear, selectedYearId: selectedYear?.id ?? null, setSelectedYear, loading, error, accessDenied, refreshYears, activateYear }}
    >
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYears() {
  const value = useContext(AcademicYearContext);
  if (!value) {
    throw new Error("useAcademicYears must be used inside AcademicYearProvider");
  }
  return value;
}
