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
  loading: boolean;
  error: string | null;
  accessDenied: boolean;
  canSwitchYear: boolean;
  refreshYears: () => Promise<void>;
  activateYear: (id: string) => Promise<void>;
};

const AcademicYearContext = createContext<AcademicYearContextValue | null>(null);

export function AcademicYearProvider({ children }: { children: ReactNode }) {
  const { role } = useAdminSession();
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const canSwitchYear = Boolean(role && hasPermission(role, "academic_years.view") && (role === "admin" || role === "principal" || role === "super_admin"));
  const activeYear = useMemo(() => years.find((year) => year.isActive) ?? null, [years]);

  const refreshYears = useCallback(async () => {
    if (!isFirebaseConfigured) {
      setYears([]);
      setLoading(false);
      setError("Firebase web config is required to load academic years.");
      return;
    }

    setLoading(true);
    setError(null);
    setAccessDenied(false);
    try {
      const result = await adminApiRequest<{ ok: true; years: AcademicYear[] }>("/api/admin/academic-years");
      setYears(result.years);
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
      await refreshYears();
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
      value={{ years, activeYear, loading, error, accessDenied, canSwitchYear, refreshYears, activateYear }}
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
