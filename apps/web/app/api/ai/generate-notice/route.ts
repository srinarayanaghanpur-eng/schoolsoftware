import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiUtils";
import { createAiClient } from "@/lib/ai/geminiClient";
import { aiLog } from "@/lib/ai/aiLogger";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getSchoolId } from "@/lib/schoolScope";
import { buildNoticePrompt, SYSTEM_PROMPT } from "@/lib/ai/aiPrompts";
import { checkGeminiQuota, recordGeminiCall, estimateTokens, truncatePrompt } from "@/lib/quota/geminiQuotaGuard";
import { getCachedResponse, setCachedResponse, getCacheTtlForFeature } from "@/lib/quota/cacheManager";

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.GENERATE_NOTICE);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const { topic, language = "English", tone = "formal", target = "parents" } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "Notice topic is required" }, { status: 400 });
    }

    const schoolId = getSchoolId(token);
    const cacheKey = `notice_${topic}_${language}_${tone}_${target}`;
    const cacheTtl = getCacheTtlForFeature("notice_generator");

    const cached = await getCachedResponse({
      schoolId,
      input: cacheKey,
      feature: "notice_generator",
      ttlMinutes: cacheTtl,
    });

    if (cached.output) {
      return NextResponse.json({
        ok: true,
        notice: cached.output,
        fromCache: true,
        hitCount: cached.hitCount,
        metadata: { topic, language, tone, target },
        message: "Cached response used. No Gemini request consumed.",
      });
    }

    const quotaCheck = await checkGeminiQuota({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature: "notice_generator",
    });

    if (!quotaCheck.allowed) {
      return NextResponse.json({
        ok: false,
        error: quotaCheck.message || "AI quota limit reached.",
        mode: quotaCheck.mode,
      }, { status: 429 });
    }

    const noticePrompt = buildNoticePrompt({ topic, language, tone, target });
    const safePrompt = truncatePrompt(noticePrompt, 1500);
    const estimatedTokens = estimateTokens(safePrompt);

    const { client, config } = await createAiClient();

    const response = await client.models.generateContent({
      model: config.model,
      contents: [{ role: "user", parts: [{ text: safePrompt }] }],
      config: {
        systemInstruction: { text: SYSTEM_PROMPT, role: undefined },
        temperature: Math.min(config.temperature, 0.7),
        maxOutputTokens: Math.min(config.maxOutputTokens, 1024),
      },
    });

    const outputText = response.text || "";

    await recordGeminiCall({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature: "notice_generator",
      inputTokens: estimatedTokens,
      outputTokens: estimateTokens(outputText),
      success: true,
    });

    await setCachedResponse({
      schoolId,
      input: cacheKey,
      output: outputText,
      feature: "notice_generator",
      ttlMinutes: cacheTtl,
    });

    await aiLog({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature: "notice_generator",
      promptType: "generate_notice",
      inputPreview: `Topic: ${topic}, Language: ${language}, Tone: ${tone}, Target: ${target}`,
      outputPreview: outputText.slice(0, 500),
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      notice: outputText,
      fromCache: false,
      metadata: { topic, language, tone, target },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate notice";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
