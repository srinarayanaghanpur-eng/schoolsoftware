import { json, requireAuthenticated, resolveRole } from "@/lib/apiUtils";
import { recordSessionActivity } from "@/lib/activityLog";

export const runtime = "nodejs";

/** Logs a web sign-out before the client revokes its session. */
export async function POST(req: Request) {
  const token = await requireAuthenticated(req);
  if (!token) {
    return json({ ok: false, error: "Authentication required." }, { status: 401 });
  }
  const role = await resolveRole(token);
  await recordSessionActivity(req, token, "user.logout", role, "Signed out of the web app");
  return json({ ok: true });
}
