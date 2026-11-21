import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export const SESSION_COOKIE_NAME = "__session";
export const SESSION_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;

export type ServerSessionUser = {
  uid: string;
  email?: string;
  role?: string;
};

/**
 * Verifies the httpOnly session cookie issued by POST /api/auth/session.
 * Returns null for missing, expired, revoked, or invalid cookies so callers
 * can redirect without leaking why verification failed.
 */
export async function getServerSessionUser(): Promise<ServerSessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  let decoded: DecodedIdToken;
  try {
    decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return null;
  }

  let role = typeof decoded.role === "string" ? decoded.role : undefined;

  // Older accounts may only have the role on the users document.
  if (!role) {
    try {
      const snap = await adminDb().collection("users").doc(decoded.uid).get();
      const data = snap.data();
      if (data && typeof data.role === "string") role = data.role;
      if (data && typeof data.status === "string" && data.status !== "active") return null;
    } catch {
      return null;
    }
  }

  return { uid: decoded.uid, email: decoded.email, role };
}

/** Roles allowed to open the /admin back office (mirrors lib/routeAccess.ts). */
export const BACK_OFFICE_ROLES = new Set([
  "super_admin",
  "admin",
  "principal",
  "accountant",
  "settings_manager"
]);
