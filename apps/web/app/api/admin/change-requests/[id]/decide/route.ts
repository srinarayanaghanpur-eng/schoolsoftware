import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, json, resolveRole } from "@/lib/apiUtils";
import { decideChangeRequest, isApproverRole } from "@/lib/changeApprovals";

// POST /api/admin/approvals/[id]/decide — approvers only.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const token = await verifyBearerToken(req);
  if (!token) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const role = await resolveRole(token);
  if (!isApproverRole(role)) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const bodyLimit = enforceBodyLimit(req, 4 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const decision = body.decision === "rejected" ? "rejected" : "approved";
    const request = await decideChangeRequest(params.id, decision, token.uid);
    return json({ ok: true, request });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to decide request";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
