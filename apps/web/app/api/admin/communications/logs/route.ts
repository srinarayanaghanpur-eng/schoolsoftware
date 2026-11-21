import { adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, json, requirePermission, serializeDoc } from "@/lib/apiUtils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requirePermission(req, "communication.view");
  if (!auth) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const snap = await adminDb().collection("communication_logs").orderBy("createdAt", "desc").limit(100).get();
    const logs = snap.docs.map((doc) => serializeDoc(doc));
    return json({ ok: true, logs });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to load communication logs") }, { status: 500 });
  }
}
