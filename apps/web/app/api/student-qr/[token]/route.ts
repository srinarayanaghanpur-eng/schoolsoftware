import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, json } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

const INVALID = { ok: false, error: "Invalid QR code" } as const;

/**
 * GET /api/student-qr/[token]
 * Resolves an opaque QR token server-side. Unauthenticated by design — the
 * 192-bit token IS the capability — so it is IP rate-limited and returns only
 * the five fields StudentDetailsReveal displays. Every failure mode returns
 * the same 404 body apart from an explicit "expired" message.
 *
 * The token stays re-readable until its expiry (the admin may reopen the QR
 * modal); `usedAt` is recorded on first successful read for auditing.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit({
      key: `student_qr_reveal:${ip}`,
      maxRequests: 30,
      windowMinutes: 1
    });
    if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

    const bodyLimit = enforceBodyLimit(req, 1024);
    if (bodyLimit) return bodyLimit;

    const token = typeof params.token === "string" ? params.token : "";
    // randomBytes(24).toString("base64url") is always 32 chars; reject anything
    // else before touching Firestore so malformed input cannot be probed.
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
      return json(INVALID, { status: 404 });
    }

    const db = adminDb();
    const ref = db.collection("student_qr_tokens").doc(token);
    const snap = await ref.get();
    if (!snap.exists) return json(INVALID, { status: 404 });

    const data = snap.data() as {
      details?: Record<string, unknown>;
      expiresAt?: { toMillis: () => number };
      usedAt?: unknown;
    };

    const expiresAt = typeof data.expiresAt?.toMillis === "function" ? data.expiresAt.toMillis() : 0;
    if (!expiresAt || expiresAt <= Date.now()) {
      return json({ ok: false, error: "QR code expired" }, { status: 404 });
    }

    if (!data.usedAt) {
      await ref.update({ usedAt: FieldValue.serverTimestamp() }).catch(() => undefined);
    }

    const details = data.details ?? {};
    return json({
      ok: true,
      details: {
        name: String(details.name || ""),
        fatherName: String(details.fatherName || ""),
        motherName: String(details.motherName || ""),
        phone: String(details.phone || ""),
        address: String(details.address || "")
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid QR code";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
