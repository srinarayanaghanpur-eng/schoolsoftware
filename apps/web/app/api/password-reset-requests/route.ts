import { NextResponse } from "next/server";
import { employeeIdToInternalEmail, isValidRole, passwordResetRequestCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";

// In-memory rate limiter: 10 req/min per IP to block queue-spam.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;
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

const GENERIC_SUCCESS = "If an account exists for this Login ID, a password request has been sent to admin.";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: "Too many requests. Try again later." }, { status: 429 });
    }
    const { loginId } = passwordResetRequestCreateSchema.parse(await req.json());
    const normalizedLoginId = loginId.trim().toUpperCase();
    const loginIdLower = normalizedLoginId.toLowerCase();
    const db = adminDb();

    const existing = await db
      .collection("password_reset_requests")
      .where("loginIdLower", "==", loginIdLower)
      .where("status", "==", "open")
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({
        ok: true,
        requestId: existing.docs[0].id,
        message: "A password request is already waiting for admin review."
      });
    }

    const teacherSnapshot = await db
      .collection("teachers")
      .where("employeeIdLower", "==", loginIdLower)
      .limit(1)
      .get();
    const teacherDoc = teacherSnapshot.docs[0];
    const teacher = teacherDoc?.data();

    const userSnapshot = teacherDoc
      ? null
      : await db
          .collection("users")
          .where("employeeId", "==", normalizedLoginId)
          .limit(1)
          .get();
    const userDoc = userSnapshot?.docs[0];
    const user = userDoc?.data();

    // Unknown login ID: do NOT reveal existence (enumeration fix).
    // Return generic success without creating admin queue spam.
    if (!teacherDoc && !userDoc) {
      return NextResponse.json({ ok: true, message: GENERIC_SUCCESS });
    }

    const internalEmail = employeeIdToInternalEmail(normalizedLoginId);
    const requestedAt = new Date().toISOString();
    const requestRef = db.collection("password_reset_requests").doc();

    await db.runTransaction(async (transaction) => {
      transaction.set(requestRef, {
        loginId: normalizedLoginId,
        loginIdLower,
        employeeId: typeof teacher?.employeeId === "string" ? teacher.employeeId : normalizedLoginId,
        internalEmail,
        teacherId: teacherDoc?.id ?? "",
        teacherName: typeof teacher?.fullName === "string" ? teacher.fullName : "",
        userId: !teacherDoc && userDoc ? userDoc.id : "",
        userName: !teacherDoc && typeof user?.displayName === "string" ? user.displayName : "",
        userRole: !teacherDoc && isValidRole(user?.role) ? user.role : "",
        targetType: teacherDoc ? "teacher" : userDoc ? "user" : "unknown",
        status: "open",
        requestedAt
      });
      transaction.set(db.collection("admin_notifications").doc(), {
        type: "password_reset_request",
        title: "Password reset request",
        message: `${normalizedLoginId} requested password help.`,
        relatedCollection: "password_reset_requests",
        relatedId: requestRef.id,
        status: "open",
        createdAt: requestedAt
      });
    });

    return NextResponse.json({
      ok: true,
      requestId: requestRef.id,
      message: GENERIC_SUCCESS
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create password request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
