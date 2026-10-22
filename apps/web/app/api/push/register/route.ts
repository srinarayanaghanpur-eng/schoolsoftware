import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, json, requireAuthenticated, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { pushRegisterSchema, sha256Hex } from "@/lib/push/sendPush";

/** Max devices per user; the oldest registration is evicted past this. */
const MAX_TOKENS_PER_USER = 5;

export async function POST(req: Request) {
  const auth = await requireAuthenticated(req);
  if (!auth) return json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(auth);
  if (!role) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({
    key: `push-register:${auth.uid}`,
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
  const parsed = pushRegisterSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "Invalid request" }, { status: 400 });

  const db = adminDb();
  const id = sha256Hex(parsed.data.token);
  const ref = db.collection("push_tokens").doc(id);
  const now = FieldValue.serverTimestamp();
  const existing = await ref.get();
  const previous = existing.exists ? (existing.data() as Record<string, unknown>) : null;

  // uid ALWAYS comes from the verified ID token, never from the client.
  await ref.set({
    uid: auth.uid,
    role,
    token: parsed.data.token,
    platform: parsed.data.platform ?? "",
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    lastSuccessAt: previous?.lastSuccessAt ?? null
  });

  // Cap at 5 tokens per user, evicting the oldest. In-memory sort avoids a
  // composite index; the set is tiny by construction.
  const mine = await db.collection("push_tokens").where("uid", "==", auth.uid).get();
  const byAge = mine.docs
    .map((doc) => {
      const created = doc.data()?.createdAt;
      const millis =
        created && typeof (created as { toMillis?: () => number }).toMillis === "function"
          ? (created as { toMillis: () => number }).toMillis()
          : null;
      return { ref: doc.ref, millis };
    })
    .sort((a, b) => {
      // Docs with no timestamp yet (just written) count as newest — the
      // token being registered must never evict itself.
      if (a.millis === null && b.millis === null) return 0;
      if (a.millis === null) return -1;
      if (b.millis === null) return 1;
      return b.millis - a.millis;
    });
  const overflow = byAge.slice(MAX_TOKENS_PER_USER);
  await Promise.all(overflow.map((entry) => entry.ref.delete()));

  return json({ ok: true });
}
