import { verifyBearerToken } from "@/lib/firebaseAdmin";
import { enforceBodyLimit, json, resolveRole } from "@/lib/apiUtils";
import { checkRateLimit } from "@/lib/quota/rateLimiter";
import {
  createChangeRequest, isApproverRole, listChangeRequests
} from "@/lib/changeApprovals";

const STAFF_ROLES = ["super_admin", "admin", "principal", "accountant", "teacher", "settings_manager"] as const;

function displayName(token: { name?: string; email?: string; uid: string }): string {
  const name = typeof token.name === "string" && token.name.trim() ? token.name.trim() : "";
  if (name) return name;
  const email = typeof token.email === "string" ? token.email : "";
  return email || token.uid;
}

// GET /api/admin/change-requests?status= — pending queue for approvers.
export async function GET(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const role = await resolveRole(token);
  if (!isApproverRole(role)) return json({ ok: false, error: "Access denied" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || "pending";
  if (status !== "pending" && status !== "approved" && status !== "rejected") {
    return json({ ok: false, error: "Invalid status" }, { status: 400 });
  }
  const requests = await listChangeRequests(status);
  return json({ ok: true, requests });
}

// POST /api/admin/change-requests — staff raise an edit/delete request.
export async function POST(req: Request) {
  const token = await verifyBearerToken(req);
  if (!token) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const role = await resolveRole(token);
  if (!role || !(STAFF_ROLES as readonly string[]).includes(role)) {
    return json({ ok: false, error: "Access denied" }, { status: 403 });
  }

  const limit = await checkRateLimit({ key: `approval-create:${token.uid}`, maxRequests: 30, windowMinutes: 1 });
  if (!limit.allowed) return json({ ok: false, error: "Too many requests" }, { status: 429 });

  const bodyLimit = enforceBodyLimit(req, 16 * 1024);
  if (bodyLimit) return bodyLimit;

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = await createChangeRequest({
      entity: String(body.entity ?? ""),
      entityId: String(body.entityId ?? ""),
      action: body.action === "delete" ? "delete" : "edit",
      patch: body.patch,
      note: typeof body.note === "string" ? body.note : "",
      requestedBy: token.uid,
      requestedByName: displayName(token)
    });
    return json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to raise request";
    return json({ ok: false, error: message }, { status: 400 });
  }
}
