import { FieldValue } from "firebase-admin/firestore";
import { noticeCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, requirePermission, serializeDoc, json } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";

const COLLECTION = "notices";

// GET /api/admin/notices — list notices (newest first).
export async function GET(req: Request) {
  const token = await requirePermission(req, "communication.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const snapshot = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(100).get();
  const notices = snapshot.docs.map((doc) => serializeDoc(doc));
  return json({ ok: true, notices });
}

// POST /api/admin/notices — create a notice/circular.
export async function POST(req: Request) {
  const token = await requirePermission(req, "communication.create");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `notice-create:${token.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 32 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = noticeCreateSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const externalChannels = parsed.channels.filter((c) => c !== "app");
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      createdBy: token.uid,
      // delivery bookkeeping for the future SMS/WhatsApp/email integration
      deliveredApp: parsed.channels.includes("app"),
      pendingChannels: externalChannels,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id, pendingChannels: externalChannels });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create notice";
    return json({ ok: false, error: message }, { status: 400 });
  }
}

