import { json } from "@/lib/apiUtils";
import { isReceiptShareToken, getPublicReceiptByShareToken } from "@/lib/receiptService";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

export const dynamic = "force-dynamic";

// Every failure returns the same body/status: a caller must not be able to
// tell whether a token exists, expired, or belongs to a cancelled receipt.
const NOT_FOUND = { ok: false, error: "Receipt not found" } as const;
const NOINDEX = { "X-Robots-Tag": "noindex, nofollow" };

/**
 * GET /api/public/receipts/[token]
 * Unauthenticated by design — the 192-bit token IS the capability. It is IP
 * rate-limited and only ever returns the sanitized public receipt shape.
 */
export async function GET(req: Request, { params }: { params: { token: string } }) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit({
      key: `public_receipt_share:${ip}`,
      maxRequests: 30,
      windowMinutes: 1
    });
    if (!limit.allowed) {
      return json({ ok: false, error: "Too many requests" }, { status: 429, headers: NOINDEX });
    }

    const token = typeof params.token === "string" ? params.token : "";
    if (!isReceiptShareToken(token)) {
      return json(NOT_FOUND, { status: 404, headers: NOINDEX });
    }

    const receipt = await getPublicReceiptByShareToken(token);
    if (!receipt) {
      return json(NOT_FOUND, { status: 404, headers: NOINDEX });
    }

    return json({ ok: true, receipt }, { headers: NOINDEX });
  } catch (error) {
    console.error("[public-receipt] lookup failed:", error);
    return json(NOT_FOUND, { status: 404, headers: NOINDEX });
  }
}
