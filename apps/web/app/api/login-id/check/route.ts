import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

export async function GET(req: Request) {
  try {
    // 30 req/min per IP (Firestore-backed — a per-instance Map resets on every
    // serverless cold start and never actually throttled anyone).
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit({ key: `login_id_check:${ip}`, maxRequests: 30, windowMinutes: 1 });
    if (!limit.allowed) {
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
