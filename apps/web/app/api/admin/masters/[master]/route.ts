import { FieldValue } from "firebase-admin/firestore";
import type { Permission } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { getMasterConfig } from "@/lib/masterConfig";
import { buildMasterSchema } from "@/lib/masterSchema";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { master: string } }) {
  const config = getMasterConfig(params.master);
  if (!config) return json({ ok: false, error: "Unknown master" }, { status: 404 });

  const auth = await requirePermission(req, `${config.module}.view` as Permission);
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const orderField = config.sortBy ?? "createdAt";
    const snap = await adminDb()
      .collection(config.collection)
      .orderBy(orderField, config.sortBy ? "asc" : "desc")
      .limit(500)
      .get();
    const items = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, items, collection: config.collection });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load records") }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { master: string } }) {
  const config = getMasterConfig(params.master);
  if (!config) return json({ ok: false, error: "Unknown master" }, { status: 404 });

  const auth = await requirePermission(req, `${config.module}.create` as Permission);
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `master-create:${config.slug}:${auth.uid}`, maxRequests: 40, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 16 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = buildMasterSchema(config).parse(await req.json());
    if (config.collection === "qr_sessions" && !parsed.token) {
      parsed.token = `QR${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    }
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(config.collection).add({
      ...parsed,
      schoolId: getSchoolId(auth),
      createdBy: auth.uid,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to save record") }, { status: 400 });
  }
}
