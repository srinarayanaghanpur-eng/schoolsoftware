import { json, requireAuthenticated, resolveRole } from "@/lib/apiUtils";
import { recordSessionActivity } from "@/lib/activityLog";

export const runtime = "nodejs";

/** Logs a successful web sign-in for the global activity trail. */
export async function POST(req: Request) {
  const token = await requireAuthenticated(req);
  if (!token) {
    return json({ ok: false, error: "Authentication required." }, { status: 401 });
  }
  const role = await resolveRole(token);
  await recordSessionActivity(req, token, "user.login", role, "Signed in to the web app");
  return json({ ok: true });
}
