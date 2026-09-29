import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, json, requireAuthenticated, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { pushUnregisterSchema, sha256Hex } from "@/lib/push/sendPush";

export async function POST(req: Request) {
  const auth = await requireAuthenticated(req);
  if (!auth) return json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(auth);
  if (!role) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({
    key: `push-unregister:${auth.uid}`,
    maxRequests: 30,
    windowMinutes: 1
  });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 4096);
  if (bodyLimit) return bodyLimit;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = pushUnregisterSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "Invalid request" }, { status: 400 });

  // Ownership check: delete only when the stored uid matches the verified
  // caller, so one user can never remove another's device.
  const ref = adminDb().collection("push_tokens").doc(sha256Hex(parsed.data.token));
  const snap = await ref.get();
  if (snap.exists && (snap.data() as Record<string, unknown>)?.uid === auth.uid) {
    await ref.delete();
  }
  return json({ ok: true });
}
