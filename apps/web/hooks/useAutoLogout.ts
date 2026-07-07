"use client";

import { useCallback, useEffect, useRef } from "react";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { signOut } from "firebase/auth";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "click",
  "keydown",
  "scroll",
  "touchstart",
];

export function useAutoLogout() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(async () => {
      try {
        window.sessionStorage.removeItem("erp-auth-role");
      } catch {
        // ignore
      }
      try {
        window.localStorage.removeItem("sriNarayana.selectedAcademicYear");
      } catch {
        // ignore
      }
      if (isFirebaseConfigured) {
        try {
          await signOut(auth);
        } catch {
          // ignore
        }
      }
      window.location.href = "/login?reason=session-expired";
    }, INACTIVITY_TIMEOUT);
  }, [clearTimer]);

  const handleActivity = useCallback(() => {
    startTimer();
  }, [startTimer]);

  useEffect(() => {
    startTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      clearTimer();
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [startTimer, clearTimer, handleActivity]);
}
