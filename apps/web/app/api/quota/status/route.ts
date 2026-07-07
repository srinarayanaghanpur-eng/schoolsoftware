import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiUtils";
import { getSchoolId } from "@/lib/schoolScope";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getDailyUsage, getTodayUsageByUser, getTodayUsageByFeature, getCurrentQuotaMode, getQuotaSettings } from "@/lib/quota/usageLogger";
import { getCacheStats } from "@/lib/quota/cacheManager";

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.VIEW);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const schoolId = getSchoolId(token);
    const usage = await getDailyUsage(schoolId);
    const userUsage = await getTodayUsageByUser(schoolId);
    const featureUsage = await getTodayUsageByFeature(schoolId);
    const mode = await getCurrentQuotaMode(schoolId);
    const settings = await getQuotaSettings(schoolId);
    const cacheStats = await getCacheStats(schoolId);

    return NextResponse.json({
      ok: true,
      data: {
        usage,
        userUsage,
        featureUsage,
        mode,
        settings,
        cacheStats: {
          totalEntries: cacheStats.totalEntries,
          totalHits: cacheStats.totalHits,
          hitRate: Math.round(cacheStats.hitRate * 100),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load quota status";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
