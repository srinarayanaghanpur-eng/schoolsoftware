import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { clearAiCache } from "@/lib/quota/cacheManager";
import { resetRateLimiter } from "@/lib/quota/rateLimiter";

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.SETTINGS);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const schoolId = getSchoolId(token);
    const body = await req.json().catch(() => ({}));

    if (body.action === "clear_cache") {
      await clearAiCache(schoolId);
      return NextResponse.json({ ok: true, message: "AI cache cleared." });
    }

    if (body.action === "reset_all") {
      await clearAiCache(schoolId);
      resetRateLimiter();
      return NextResponse.json({ ok: true, message: "Cache and rate limits reset." });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset cache";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
