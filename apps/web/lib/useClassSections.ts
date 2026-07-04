"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApiRequest } from "@/lib/adminApiClient";
import { DEFAULT_SECTIONS, defaultSectionsByClass } from "@/lib/classSections";

const CACHE_KEY = "sriNarayana.classSections";
const CACHE_MS = 5 * 60 * 1000;

type SectionsByClass = Record<string, string[]>;

function readCache(): SectionsByClass | null {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { sections?: SectionsByClass; expiresAt?: number };
    if (!parsed.expiresAt || parsed.expiresAt <= Date.now() || !parsed.sections) {
      window.sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.sections;
  } catch {
    return null;
  }
}

function writeCache(sections: SectionsByClass) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ sections, expiresAt: Date.now() + CACHE_MS }));
  } catch {
    // storage may be blocked; worst case we refetch next mount
  }
}

/**
 * Per-class section lists from settings/classSections (default A/B).
 * Cached in sessionStorage for 5 minutes; call refresh(true) after editing.
 */
export function useClassSections() {
  const [sectionsByClass, setSectionsByClass] = useState<SectionsByClass>(() => defaultSectionsByClass());
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) {
        setSectionsByClass(cached);
        setLoaded(true);
        return;
      }
    }
    try {
      const data = await adminApiRequest<{ ok: boolean; sections?: SectionsByClass }>("/api/admin/class-sections");
      if (data.sections) {
        setSectionsByClass(data.sections);
        writeCache(data.sections);
      }
    } catch {
      // keep defaults (A/B) on failure
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sectionsFor = useCallback(
    (classId: string): string[] => sectionsByClass[classId] ?? [...DEFAULT_SECTIONS],
    [sectionsByClass]
  );

  // Push a locally-known update (e.g. the PUT/merge response) into state+cache
  // without spending another read.
  const applySections = useCallback((classId: string, sections: string[]) => {
    setSectionsByClass((prev) => {
      const next = { ...prev, [classId]: sections };
      writeCache(next);
      return next;
    });
  }, []);

  return { sectionsByClass, sectionsFor, loaded, refresh, applySections };
}
