import { json } from "@/lib/apiUtils";
import { adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

export const dynamic = "force-dynamic";

const NOT_FOUND = { ok: false, error: "Certificate not found" } as const;
const NOINDEX = { "X-Robots-Tag": "noindex, nofollow" };

/**
 * GET /api/public/certificates/[...certNo]
 * Unauthenticated certificate verification (QR target). Rate-limited and
 * returns only the fields printed on the certificate itself.
 */
export async function GET(req: Request, { params }: { params: { certNo: string[] } }) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit({
      key: `public_cert_verify:${ip}`,
      maxRequests: 30,
      windowMinutes: 1
    });
    if (!limit.allowed) {
      return json({ ok: false, error: "Too many requests" }, { status: 429, headers: NOINDEX });
    }

    const certNo = (params.certNo || []).join("/").trim();
    if (!certNo || certNo.length > 160) {
      return json(NOT_FOUND, { status: 404, headers: NOINDEX });
    }

    const snap = await adminDb()
      .collection("certificates")
      .where("certificateNumber", "==", certNo)
      .limit(1)
      .get();

    if (snap.empty) {
      return json(NOT_FOUND, { status: 404, headers: NOINDEX });
    }

    const data = snap.docs[0].data();
    const status = typeof data.status === "string" ? data.status : "issued";

    return json(
      {
        ok: true,
        valid: status !== "cancelled",
        certificate: {
          certificateNumber: data.certificateNumber ?? certNo,
          certificateType: data.certificateType ?? "",
          studentName: data.studentName ?? "",
          className: data.className ?? "",
          section: data.section ?? "",
          issueDate: data.issueDate ?? "",
          status
        }
      },
      { headers: NOINDEX }
    );
  } catch (error) {
    console.error("[public-certificate] lookup failed:", error);
    return json(NOT_FOUND, { status: 404, headers: NOINDEX });
  }
}
