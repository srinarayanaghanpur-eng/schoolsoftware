import { json, resolveRole } from "@/lib/apiUtils";
import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { getLinkedStudentIds } from "@/lib/portalHelpers";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getOrCreateReceiptShareToken, getReceiptById } from "@/lib/receiptService";
import { roleHasPermission } from "@/lib/rbacAdmin";

function configuredBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

/** Only the configured public URL or the actual request origin is trusted. */
function publicBaseUrl(request: Request) {
  const configured = configuredBaseUrl();
  if (configured) return configured;
  const vercelHost = (process.env.VERCEL_URL || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (vercelHost) return `https://${vercelHost}`;
  return new URL(request.url).origin;
}

/**
 * POST /api/receipts/[receiptId]/share-link
 * Creates (or reuses, until expiry) the receipt's public share token and
 * returns the absolute /r/[token] URL. Allowed for fee viewers and for a
 * parent/guardian linked to the receipt's student.
 */
export async function POST(req: Request, { params }: { params: { receiptId: string } }) {
  const token = await verifyBearerToken(req);
  if (!token) return json({ ok: false, error: "Authentication required" }, { status: 401 });

  const role = await resolveRole(token);
  const canViewFees = await roleHasPermission(role, "fees.view");
  const canViewPortal = canViewFees ? true : await roleHasPermission(role, "portal.view");
  if (!canViewFees && !canViewPortal) {
    return json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const limit = await checkRateLimit({
    key: `receipt_share_link:${token.uid}`,
    maxRequests: 60,
    windowMinutes: 1
  });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const receipt = await getReceiptById(params.receiptId);
  if (!receipt) return json({ ok: false, error: "Receipt not found" }, { status: 404 });

  if (!canViewFees) {
    const linkedStudentIds = await getLinkedStudentIds(token);
    if (!linkedStudentIds.includes(receipt.studentId)) {
      return json({ ok: false, error: "Access denied" }, { status: 403 });
    }
  }

  const issued = await getOrCreateReceiptShareToken(receipt.id);
  if (!issued) return json({ ok: false, error: "Receipt not found" }, { status: 404 });

  return json({
    ok: true,
    url: `${publicBaseUrl(req)}/r/${encodeURIComponent(issued.token)}`,
    expiresAt: issued.expiresAt.toISOString()
  });
}
