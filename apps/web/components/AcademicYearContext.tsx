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
  canSwitchYear: boolean;
  refreshYears: (options?: { force?: boolean }) => Promise<void>;
  activateYear: (id: string) => Promise<void>;
};

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null);
const ACADEMIC_YEARS_CLIENT_CACHE_MS = 5 * 60 * 1000;
const ACADEMIC_YEARS_CLIENT_CACHE_KEY = "sriNarayana.academicYears";
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

function readCachedAcademicYears(): AcademicYear[] | null {
  try {
    const raw = window.sessionStorage.getItem(ACADEMIC_YEARS_CLIENT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { years?: AcademicYear[]; expiresAt?: number };
    if (!parsed.expiresAt || parsed.expiresAt <= Date.now() || !Array.isArray(parsed.years)) {
      window.sessionStorage.removeItem(ACADEMIC_YEARS_CLIENT_CACHE_KEY);
      return null;
    }
    return parsed.years;
  } catch {
    return null;
  }
}

function cacheAcademicYears(years: AcademicYear[]) {
  try {
    window.sessionStorage.setItem(
      ACADEMIC_YEARS_CLIENT_CACHE_KEY,
      JSON.stringify({ years, expiresAt: Date.now() + ACADEMIC_YEARS_CLIENT_CACHE_MS })
    );
  } catch {
    // Session storage can be blocked; server-side caching still reduces duplicate reads.
  }
}

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { role } = useAdminSession();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const [selectedYearId, setSelectedYearId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredSelectedYearId()
  );

  const canSwitchYear = Boolean(role && hasPermission(role, "academic_years.view") && (role === "admin" || role === "principal" || role === "super_admin"));
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

    if (!options?.force) {
      const cachedYears = readCachedAcademicYears();
      if (cachedYears) {
        setYears(cachedYears);
        setLoading(false);
        setError(null);
        setAccessDenied(false);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const path = options?.force ? "/api/admin/academic-years?refresh=1" : "/api/admin/academic-years";
      const result = await adminApiRequest<{ ok: true; years: AcademicYear[] }>(path);
      setYears(result.years);
      cacheAcademicYears(result.years);
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 403) {
        setAccessDenied(true);
        setError("Access denied");
      } else {
        setError(err instanceof Error ? err.message : "Unable to load academic years");
      }
    } finally {
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
      value={{ years, activeYear, selectedYear, selectedYearId: selectedYear?.id ?? null, setSelectedYear, loading, error, accessDenied, canSwitchYear, refreshYears, activateYear }}
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
