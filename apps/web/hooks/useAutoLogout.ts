"use client";

import { useCallback, useEffect, useRef } from "react";
import { auth, isFirebaseConfigured } from "@sri-narayana/shared/firebase/client";
import { signOut } from "firebase/auth";
import { clearAdminApiCacheForSignOut } from "@/lib/adminApiClient";
import { clearAuthStorage, markLogoutRedirect } from "@/lib/authStorage";
import { clearPayrollSessionId } from "@/lib/payrollSessionClient";

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
      clearPayrollSessionId();
      clearAdminApiCacheForSignOut();
      markLogoutRedirect();
      if (isFirebaseConfigured) {
        try {
          await signOut(auth);
        } catch {
          // ignore
        }
      }
      clearAuthStorage();
      window.location.href = "/login?reason=session-expired&loggedOut=1";
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
