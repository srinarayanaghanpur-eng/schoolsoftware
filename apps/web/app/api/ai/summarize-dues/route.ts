import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { aiLog } from "@/lib/ai/aiLogger";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getSchoolId } from "@/lib/schoolScope";
import { checkQuotaBeforeOp, getFeeDueSummary, buildFeeDueSummary } from "@/lib/quota/firebaseQuotaGuard";
import { getCachedResponse, setCachedResponse, getCacheTtlForFeature } from "@/lib/quota/cacheManager";

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.SUMMARIZE_REPORTS);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const { className, section, feeType, academicYearId } = body;
    const schoolId = getSchoolId(token);
    const ayId = academicYearId || "current";

    const cacheKey = `dues_summary_${schoolId}_${ayId}_${className || "all"}_${section || "all"}_${feeType || "all"}`;
    const cacheTtl = getCacheTtlForFeature("dues_summary");

    const cached = await getCachedResponse({
      schoolId,
      input: cacheKey,
      feature: "dues_summary",
      ttlMinutes: cacheTtl,
    });

    if (cached.output) {
      const parsed = JSON.parse(cached.output) as Record<string, unknown>;
      return NextResponse.json({
        ok: true,
        summary: parsed,
        filters: { className, section, feeType },
        fromCache: true,
        hitCount: cached.hitCount,
        message: "Cached response used. No Gemini request consumed.",
      });
    }

    const fbQuota = await checkQuotaBeforeOp(schoolId, 10);
    if (!fbQuota.allowed) {
      return NextResponse.json({
        ok: false,
        error: fbQuota.message || "Firebase quota protection active.",
        mode: fbQuota.mode,
      }, { status: 429 });
    }

    let summary = await getFeeDueSummary(schoolId, ayId);

    if (!summary) {
      if (fbQuota.mode === "saver") {
        return NextResponse.json({
          ok: false,
          error: "Summary not available and Saver Mode prevents full scan. Try again later or use cached data.",
          mode: "saver",
        }, { status: 429 });
      }
      summary = await buildFeeDueSummary(schoolId, ayId);
    }

    const summaryData = summary as Record<string, unknown>;
    let classWiseDue = (summaryData.classWiseDue as Record<string, { count: number; total: number }>) || {};
    const topDueCases = (summaryData.topDueCases as Array<{ studentName: string; totalDue: number }>) || [];

    if (className) {
      const filtered: Record<string, { count: number; total: number }> = {};
      if (classWiseDue[className]) {
        filtered[className] = classWiseDue[className];
      }
      classWiseDue = filtered;
    }

    const classWiseSummary = Object.entries(classWiseDue).map(([cls, data]) => ({
      class: cls,
      studentCount: data.count,
      totalDue: data.total,
    }));

    const totalDueAmount = summaryData.totalDueAmount as number || classWiseSummary.reduce((s, c) => s + c.totalDue, 0);
    const totalStudents = summaryData.totalDueStudents as number || classWiseSummary.reduce((s, c) => s + c.studentCount, 0);

    const totalDueAmountFiltered = className
      ? classWiseSummary.reduce((s, c) => s + c.totalDue, 0)
      : totalDueAmount;
    const totalStudentsFiltered = className
      ? classWiseSummary.reduce((s, c) => s + c.studentCount, 0)
      : totalStudents;

    const reminderPlan =
      totalStudentsFiltered > 0
        ? `Send reminders to ${totalStudentsFiltered} students with total dues of Rs ${totalDueAmountFiltered.toLocaleString()}. Consider sending class-wise reminders starting with highest due classes first.`
        : "No dues to remind.";

    const output = JSON.stringify({
      totalStudents: totalStudentsFiltered,
      totalDueAmount: totalDueAmountFiltered,
      classWiseSummary,
      topDueCases: topDueCases.slice(0, 10),
      suggestedReminderPlan: reminderPlan,
      summaryUpdatedAt: summaryData.updatedAt || null,
    });

    await setCachedResponse({
      schoolId,
      input: cacheKey,
      output,
      feature: "dues_summary",
      ttlMinutes: cacheTtl,
    });

    const parsed = JSON.parse(output);

    await aiLog({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature: "dues_summary",
      promptType: "summarize_dues",
      inputPreview: `Filters: class=${className || "all"}, section=${section || "all"}, feeType=${feeType || "all"}`,
      outputPreview: `Total students: ${parsed.totalStudents}, Total due: Rs ${parsed.totalDueAmount}`,
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      summary: parsed,
      filters: { className, section, feeType },
      fromCache: false,
      summaryUpdatedAt: summaryData.updatedAt || null,
      staleWarning: summaryData.updatedAt
        ? `Summary may be outdated. Last updated: ${summaryData.updatedAt}`
        : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to summarize dues";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
