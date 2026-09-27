import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// Simple in-memory rate limiter: 30 req/min per IP. Prevents login-ID brute-force.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;
const rateMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || entry.resetAt <= now) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateMap.size > 2000) rateMap.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_MAX;
}

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: "Too many requests. Try again later.", exists: false }, { status: 429 });
    }
    const { searchParams } = new URL(req.url);
    const loginId = searchParams.get("loginId")?.trim() ?? "";
    if (!loginId) return NextResponse.json({ ok: true, exists: false });
    // Validate format to block injection / fuzzing: 3-32 alphanumerics.
    if (loginId.length < 3 || loginId.length > 32 || !/^[A-Za-z0-9_-]+$/.test(loginId)) {
      return NextResponse.json({ ok: true, exists: false });
    }

    const loginIdLower = loginId.toLowerCase();
    // Parallel: halves cold-start latency vs sequential awaits (see BUG-003).
    const [teacherSnapshot, userSnapshot] = await Promise.all([
      adminDb()
        .collection("teachers")
        .where("employeeIdLower", "==", loginIdLower)
        .limit(1)
        .get(),
      adminDb()
        .collection("users")
        .where("employeeId", "==", loginId.toUpperCase())
        .limit(1)
        .get()
    ]);

    if (!teacherSnapshot.empty) {
      return NextResponse.json({ ok: true, exists: true });
    }

    return NextResponse.json({ ok: true, exists: !userSnapshot.empty });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to check login ID";
    return NextResponse.json({ ok: false, error: message, exists: false }, { status: 400 });
  }
}
