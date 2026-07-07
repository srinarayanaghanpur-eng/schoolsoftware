import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiUtils";
import { getAiLogs } from "@/lib/ai/aiLogger";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getSchoolId } from "@/lib/schoolScope";

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.LOGS);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const url = new URL(req.url);
    const schoolId = getSchoolId(token);
    const limit = parseInt(url.searchParams.get("limit") || "25");
    const cursor = url.searchParams.get("cursor") || undefined;
    const feature = url.searchParams.get("feature") || undefined;
    const status = url.searchParams.get("status") || undefined;

    const { logs, nextCursor } = await getAiLogs({
      schoolId,
      limit,
      cursor,
      feature,
      status,
    });

    return NextResponse.json({
      ok: true,
      logs,
      nextCursor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load AI logs";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
