"use client";

import { auth } from "@sri-narayana/shared/firebase/client";

const PAYROLL_SESSION_KEY = "erp-payroll-session";

type StoredPayrollSession = {
  uid: string;
  authTime: number;
  sessionId: string;
};

function randomSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function getPayrollSessionId() {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");

  const token = await user.getIdTokenResult();
  const authTime = typeof token.claims.auth_time === "number" ? token.claims.auth_time : 0;

  try {
    const raw = window.sessionStorage.getItem(PAYROLL_SESSION_KEY);
    const stored = raw ? (JSON.parse(raw) as StoredPayrollSession) : null;
    if (stored?.uid === user.uid && stored.authTime === authTime && stored.sessionId) {
      return stored.sessionId;
    }
  } catch {
    // Regenerate below when storage is unreadable or stale.
  }

  const nextSession: StoredPayrollSession = {
    uid: user.uid,
    authTime,
    sessionId: randomSessionId()
  };
  window.sessionStorage.setItem(PAYROLL_SESSION_KEY, JSON.stringify(nextSession));
  return nextSession.sessionId;
}

export function clearPayrollSessionId() {
  try {
    window.sessionStorage.removeItem(PAYROLL_SESSION_KEY);
  } catch {
    // Ignore storage availability problems during logout.
  }
}

export async function payrollSessionHeaders() {
  return {
    "x-payroll-session-id": await getPayrollSessionId()
  };
}
