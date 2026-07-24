import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission, json } from "@/lib/apiUtils";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });
  try {
    const { id } = await params;
    await adminDb().collection("daily_km_logs").doc(id).delete();
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "Failed" }, { status: 400 });
  }
}

