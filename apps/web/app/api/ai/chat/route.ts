import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiUtils";
import { createAiClient } from "@/lib/ai/geminiClient";
import { aiLog } from "@/lib/ai/aiLogger";
import { SYSTEM_PROMPT } from "@/lib/ai/aiPrompts";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getSchoolId } from "@/lib/schoolScope";
import { checkGeminiQuota, recordGeminiCall, estimateTokens, truncatePrompt } from "@/lib/quota/geminiQuotaGuard";
import { getCachedResponse, setCachedResponse, getCacheTtlForFeature } from "@/lib/quota/cacheManager";
import { checkQuotaBeforeOp } from "@/lib/quota/firebaseQuotaGuard";

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.CHAT);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied. Missing permission: ai_agent.chat" }, { status: 403 });

    const body = await req.json();
    const { prompt, feature = "chat", useErpData = false, erpContext } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ ok: false, error: "Prompt is required" }, { status: 400 });
    }

    if (prompt.length > 10000) {
      return NextResponse.json({ ok: false, error: "Prompt is too long" }, { status: 400 });
    }

    const schoolId = getSchoolId(token);
    const cacheTtl = getCacheTtlForFeature(feature);

    const cached = await getCachedResponse({
      schoolId,
      input: prompt,
      feature,
      ttlMinutes: cacheTtl,
    });

    if (cached.output) {
      return NextResponse.json({
        ok: true,
        response: cached.output,
        fromCache: true,
        hitCount: cached.hitCount,
        message: "Cached response used. No Gemini request consumed.",
      });
    }

    const quotaCheck = await checkGeminiQuota({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature,
    });

    if (!quotaCheck.allowed) {
      return NextResponse.json({
        ok: false,
        error: quotaCheck.message || "AI quota limit reached.",
        mode: quotaCheck.mode,
      }, { status: 429 });
    }

    const fbQuota = await checkQuotaBeforeOp(schoolId, 2);
    if (!fbQuota.allowed) {
      return NextResponse.json({
        ok: false,
        error: fbQuota.message || "Firebase quota protection active.",
        mode: fbQuota.mode,
      }, { status: 429 });
    }

    const safePrompt = truncatePrompt(prompt, 2000);
    const estimatedTokens = estimateTokens(safePrompt + SYSTEM_PROMPT);

    const { client, config } = await createAiClient();

    let systemInstruction = SYSTEM_PROMPT;
    if (useErpData && erpContext) {
      const truncatedContext = Array.isArray(erpContext)
        ? erpContext.slice(0, 25)
        : erpContext;
      systemInstruction += `\n\nHere is the relevant ERP data for context:\n${JSON.stringify(truncatedContext)}`;
    }

    const response = await client.models.generateContent({
      model: config.model,
      contents: [{ role: "user", parts: [{ text: safePrompt }] }],
      config: {
        systemInstruction: { text: systemInstruction, role: undefined },
        temperature: config.temperature,
        maxOutputTokens: Math.min(config.maxOutputTokens, 1024),
      },
    });

    const outputText = response.text || "";

    await recordGeminiCall({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature,
      inputTokens: estimatedTokens,
      outputTokens: estimateTokens(outputText),
      success: true,
    });

    await setCachedResponse({
      schoolId,
      input: prompt,
      output: outputText,
      feature,
      ttlMinutes: cacheTtl,
    });

    await aiLog({
      schoolId,
      userId: token.uid,
      userName: token.name as string || "Unknown",
      role: token.role as string || "unknown",
      feature,
      promptType: feature,
      inputPreview: prompt.slice(0, 200),
      outputPreview: outputText.slice(0, 500),
      status: "success",
    });

    return NextResponse.json({
      ok: true,
      response: outputText,
      usage: response.usageMetadata || null,
      fromCache: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI chat failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
