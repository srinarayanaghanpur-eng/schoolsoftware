"use client";

import { useEffect, useRef } from "react";

const DEFAULT_FOCUS_REFRESH_COOLDOWN_MS = 2 * 60 * 1000;

/**
 * Re-runs `refresh` automatically whenever the user returns to the tab/window
 * (tab focus or visibility change), so lists show new data without a manual
 * page reload. The latest callback is always used without re-binding listeners.
 *
 * Refreshes are rate-limited (default: once per 2 minutes) so quick tab
 * switches don't repeat Firestore reads for data that was just fetched.
 */
export function useRefreshOnFocus(refresh: () => void | Promise<void>, cooldownMs = DEFAULT_FOCUS_REFRESH_COOLDOWN_MS) {
  const ref = useRef(refresh);
  ref.current = refresh;
  const lastRunRef = useRef(Date.now());
  const initialSkipRef = useRef(true);

  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== "visible") return;
      // Skip the very first focus/visibility event — the initial mount
      // useEffect already fetched the data, so this avoids a double-load.
      if (initialSkipRef.current) {
        initialSkipRef.current = false;
        return;
      }
      if (Date.now() - lastRunRef.current < cooldownMs) return;
      lastRunRef.current = Date.now();
      void ref.current();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [cooldownMs]);
}
