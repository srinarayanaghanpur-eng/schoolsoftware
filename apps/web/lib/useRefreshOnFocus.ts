"use client";

import { useEffect, useRef } from "react";

/**
 * Re-runs `refresh` automatically whenever the user returns to the tab/window
 * (tab focus or visibility change), so lists show new data without a manual
 * page reload. The latest callback is always used without re-binding listeners.
 */
export function useRefreshOnFocus(refresh: () => void | Promise<void>) {
  const ref = useRef(refresh);
  ref.current = refresh;

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") void ref.current();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, []);
}
