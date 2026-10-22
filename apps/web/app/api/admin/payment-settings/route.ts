import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, enforceBodyLimit, json } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

/**
 * GET /api/admin/payment-settings
 * UPI display configuration for the payments screen. Exposes only the two
 * non-secret display fields (upiId, payeeName) and replaces the page's direct
 * client-SDK read of settings/payment, so every screen fetches through the
 * same authenticated API surface.
 */
export async function GET(req: Request) {
  try {
    const auth = await requirePermission(req, "fees.view");
    if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

    const limit = await checkRateLimit({
      key: `payment_settings:${auth.uid}`,
      maxRequests: 120,
      windowMinutes: 1
    });
    if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

    const bodyLimit = enforceBodyLimit(req, 1024);
    if (bodyLimit) return bodyLimit;

    const snap = await adminDb().collection("settings").doc("payment").get();
    if (!snap.exists) return json({ ok: true, settings: null });

    const data = snap.data() as Record<string, unknown>;
    return json({
      ok: true,
      settings: {
        upiId: String(data.upiId || ""),
        payeeName: String(data.payeeName || "")
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load payment settings";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
