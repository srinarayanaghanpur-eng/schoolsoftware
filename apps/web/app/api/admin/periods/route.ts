import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "periods";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const periodSchema = z.object({
  label: z.string().trim().min(1).max(60),
  startTime: z.string().regex(TIME_RE, "startTime must be HH:MM"),
  endTime: z.string().regex(TIME_RE, "endTime must be HH:MM"),
  order: z.coerce.number().int().min(0).max(100).optional().default(0)
});

export async function GET(req: Request) {
  const auth = await requirePermission(req, "academics.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(COLLECTION).orderBy("order", "asc").limit(200).get();
    const periods = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, periods });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load periods") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "academics.create");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `periods-create:${auth.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 8 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = periodSchema.parse(await req.json());
    const schoolId = getSchoolId(auth);
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      schoolId,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to create period") }, { status: 400 });
  }
}
