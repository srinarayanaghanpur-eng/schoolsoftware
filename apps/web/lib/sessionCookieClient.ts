"use client";

/**
 * Client helpers for the server session cookie used by server components.
 * The cookie itself is httpOnly; this module only asks the API to set/clear it.
 */

async function currentIdToken(): Promise<string | null> {
  try {
    const { auth } = await import("@sri-narayana/shared/firebase/client");
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  } catch {
    return null;
  }
}

export async function establishServerSession(): Promise<boolean> {
  const token = await currentIdToken();
  if (!token) return false;
  try {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      credentials: "same-origin"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function clearServerSession(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
  } catch {
    // Sign-out must never be blocked by a failed cookie cleanup.
  }
}
