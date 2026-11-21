import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/serverSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exchanges a Firebase ID token (Authorization: Bearer) for an httpOnly
 * session cookie so server components can authenticate without trusting
 * client-rendered state.
 */
export async function POST(request: Request) {
  const header = request.headers.get("authorization");
  const idToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!idToken) {
    return NextResponse.json({ ok: false, error: "Missing ID token" }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid or expired ID token" }, { status: 401 });
  }

  try {
    const sessionCookie = await adminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000
    });
    const response = NextResponse.json({ ok: true, uid });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS
    });
    return response;
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to create session" }, { status: 500 });
  }
}

/** Clears the session cookie on sign-out. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
