import { FieldValue } from "firebase-admin/firestore";
import { transportBaselineSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";

const COLLECTION = "transport_baselines";

export async function GET(req: Request) {
  const token = await requirePermission(req, "transport.view");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const routeId = new URL(req.url).searchParams.get("routeId")?.trim();
  if (!routeId) return json({ ok: false, error: "routeId is required" }, { status: 400 });

  const snap = await adminDb().collection(COLLECTION).doc(routeId).get();
  const baseline = snap.exists ? serializeDoc(snap) : null;
  return json({ ok: true, routeId, baseline });
}

export async function PUT(req: Request) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const parsed = transportBaselineSchema.parse(await req.json());
    await adminDb().collection(COLLECTION).doc(parsed.routeId).set({
      routeId: parsed.routeId,
      baselineDate: parsed.baselineDate,
      stopCounts: parsed.stopCounts,
      setBy: token.uid,
      updatedAt: FieldValue.serverTimestamp()
    });
    return json({ ok: true, routeId: parsed.routeId });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Failed") }, { status: 400 });
  }
}
