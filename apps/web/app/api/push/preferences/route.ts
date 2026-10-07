import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, json, requireAuthenticated, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { DEFAULT_PUSH_PREFS, pushPrefsSchema, type PushPrefs } from "@/lib/push/sendPush";

/**
 * GET/PUT /api/push/preferences — per-category push opt-outs stored on the
 * caller's users/{uid} doc as `pushPrefs`. Every category defaults to ON;
 * sendPushToUsers skips users who switched a category OFF.
 */
export async function GET(req: Request) {
  const auth = await requireAuthenticated(req);
  if (!auth) return json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(auth);
  if (!role) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snap = await adminDb().collection("users").doc(auth.uid).get();
  const stored = (snap.data() as Record<string, unknown> | undefined)?.pushPrefs as PushPrefs | undefined;
  return json({ ok: true, prefs: { ...DEFAULT_PUSH_PREFS, ...stored } });
}

const prefsBodySchema = z.object({ prefs: pushPrefsSchema });

export async function PUT(req: Request) {
  const auth = await requireAuthenticated(req);
  if (!auth) return json({ ok: false, error: "Authentication required" }, { status: 401 });
  const role = await resolveRole(auth);
  if (!role) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({
    key: `push-prefs:${auth.uid}`,
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
  const parsed = prefsBodySchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "Invalid request" }, { status: 400 });

  const ref = adminDb().collection("users").doc(auth.uid);
  await ref.set({ pushPrefs: parsed.data.prefs, updatedAt: new Date().toISOString() }, { merge: true });
  const snap = await ref.get();
  const stored = (snap.data() as Record<string, unknown> | undefined)?.pushPrefs as PushPrefs | undefined;
  return json({ ok: true, prefs: { ...DEFAULT_PUSH_PREFS, ...stored } });
}
