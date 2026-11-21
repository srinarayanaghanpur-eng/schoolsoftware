import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";
import { feeFineRuleSchema } from "@/lib/feeFineRules";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import { getSchoolId } from "@/lib/schoolScope";

const COLLECTION = "fee_fine_rules";

export async function GET(req: Request) {
  const auth = await requirePermission(req, "fees.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection(COLLECTION).orderBy("createdAt", "desc").limit(200).get();
    const rules = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, rules });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to load fine rules") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, "fees.create");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const limit = await checkRateLimit({ key: `fee-fine-rule-create:${auth.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 8 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const parsed = feeFineRuleSchema.parse(await req.json());
    const now = FieldValue.serverTimestamp();
    const ref = await adminDb().collection(COLLECTION).add({
      ...parsed,
      schoolId: getSchoolId(auth),
      createdBy: auth.uid,
      createdAt: now,
      updatedAt: now
    });
    return json({ ok: true, id: ref.id });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed to create fine rule") }, { status: 400 });
  }
}
