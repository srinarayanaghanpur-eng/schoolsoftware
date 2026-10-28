/**
 * Best-effort sign-in / sign-out logging for the global activity trail.
 * Never throws: a failed log must not block authentication.
 */
export async function logSessionActivity(kind: "login" | "logout"): Promise<void> {
  try {
    const firebaseClient = await import("@sri-narayana/shared/firebase/client");
    const user = firebaseClient.auth?.currentUser;
    if (!user) return;
    const token = await user.getIdToken();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      // keepalive lets the request finish while the page navigates away.
      await fetch(`/api/activity/${kind}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        keepalive: true,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Activity logging is non-critical.
  }
}
