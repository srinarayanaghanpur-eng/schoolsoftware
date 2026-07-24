"use client";

const LOGOUT_REDIRECT_KEY = "snhs.logoutRedirect";

export function markLogoutRedirect() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LOGOUT_REDIRECT_KEY, "1");
  } catch {
    // ignore
  }
}

export function consumeLogoutRedirect() {
  if (typeof window === "undefined") return false;
  try {
    const shouldUseLoggedOutUrl = window.sessionStorage.getItem(LOGOUT_REDIRECT_KEY) === "1";
    window.sessionStorage.removeItem(LOGOUT_REDIRECT_KEY);
    return shouldUseLoggedOutUrl;
  } catch {
    return false;
  }
}

export function clearAuthStorage() {
  if (typeof window === "undefined") return;

  const keys = [
    "sriNarayana.rememberedSession",
    "sriNarayana.auth",
    "sriNarayana.user",
    "sriNarayana.role",
    "sriNarayana.dashboardPath",
    "rememberMe",
    "authUser",
    "userRole",
    "dashboardPath",
    "selectedRole",
    "erp-auth-role",
    "sriNarayana.selectedAcademicYear"
  ];

  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  });

  try {
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith("firebase:authUser") ||
        key.includes("sriNarayana") ||
        key.includes("rememberedSession")
      ) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // ignore
  }

  try {
    Object.keys(sessionStorage).forEach((key) => {
      if (
        key.startsWith("firebase:authUser") ||
        key.includes("sriNarayana") ||
        key.includes("rememberedSession")
      ) {
        sessionStorage.removeItem(key);
      }
    });
  } catch {
    // ignore
  }
}
