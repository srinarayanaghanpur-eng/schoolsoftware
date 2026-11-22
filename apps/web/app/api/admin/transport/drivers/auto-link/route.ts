import { errorMessage, json, requirePermission, resolveRole } from "@/lib/apiUtils";
import { buildLinkMatches, linkDriverToUser } from "@/lib/driverLink";

export async function POST(req: Request) {
  const token = await requirePermission(req, "transport.edit");
  if (!token) return json({ ok: false, error: "Access denied" }, { status: 403 });

  try {
    const body = (await req.json().catch(() => ({}))) as { apply?: unknown };
    const apply = body?.apply === true;
    const actorRole = (await resolveRole(token)) ?? "unknown";
    const report = await buildLinkMatches();

    if (!apply) {
      return json({
        ok: true,
        dryRun: true,
        candidates: report.candidates,
        conflicts: report.conflicts,
        alreadyLinked: report.alreadyLinked,
        unmatched: report.unmatched
      });
    }

    const linked: Array<{ driverId: string; uid: string }> = [];
    const failed: Array<{ driverId: string; uid: string; error: string }> = [];
    for (const candidate of report.candidates) {
      const result = await linkDriverToUser({
        driverId: candidate.driverId,
        uid: candidate.candidateUid,
        actorId: token.uid,
        actorRole
      });
      if (result.ok) {
        linked.push({ driverId: candidate.driverId, uid: candidate.candidateUid });
      } else {
        failed.push({
          driverId: candidate.driverId,
          uid: candidate.candidateUid,
          error: result.error
        });
      }
    }

    return json({
      ok: true,
      dryRun: false,
      linked,
      failed,
      conflicts: report.conflicts,
      alreadyLinked: report.alreadyLinked,
      unmatched: report.unmatched
    });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to link drivers") }, { status: 400 });
  }
}
