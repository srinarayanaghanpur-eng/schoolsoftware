import { errorMessage, json, requirePermission, resolveRole } from "@/lib/apiUtils";
import { linkDriverToUser } from "@/lib/driverLink";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const { id } = await params;
    const body = (await req.json()) as { uid?: unknown };
    const uid = typeof body?.uid === "string" ? body.uid.trim() : "";
    if (!uid) return json({ ok: false, error: "uid is required" }, { status: 400 });

    const result = await linkDriverToUser({
      driverId: id,
      uid,
      actorId: token.uid,
      actorRole: (await resolveRole(token)) ?? "unknown"
    });
    if (!result.ok) return json({ ok: false, error: result.error }, { status: result.status });

    return json({ ok: true, uid: result.uid, driverId: result.driverId });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to link driver") }, { status: 400 });
  }
}
