import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/apiUtils";
import { testGeminiConnection, createAiClient } from "@/lib/ai/geminiClient";
import { aiLog } from "@/lib/ai/aiLogger";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getSchoolId } from "@/lib/schoolScope";

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.SETTINGS);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied" }, { status: 403 });

    const body = await req.json();
    const apiKey = body.apiKey;

    if (apiKey) {
      const isConnected = await testGeminiConnection(apiKey);

      const schoolId = getSchoolId(token);
      await aiLog({
        schoolId,
        userId: token.uid,
        userName: token.name as string || "Unknown",
        role: token.role as string || "unknown",
        feature: "settings",
        promptType: "test_connection",
        inputPreview: "Test connection with provided key",
        outputPreview: isConnected ? "Connected" : "Failed",
        status: isConnected ? "success" : "failed",
        errorMessage: isConnected ? undefined : "Connection test failed",
      });

      if (!isConnected) {
        return NextResponse.json({ ok: false, error: "Test connection failed. Please check your API key." }, { status: 400 });
      }

      return NextResponse.json({ ok: true, message: "Gemini API connected successfully." });
    }

    try {
      const { client, config } = await createAiClient();
      const response = await client.models.generateContent({
        model: config.model,
        contents: "Reply only: Gemini connected.",
      });
      const text = response.text?.trim().toLowerCase() || "";
      const isConnected = text.includes("gemini connected");

      const schoolId = getSchoolId(token);
      await aiLog({
        schoolId,
        userId: token.uid,
        userName: token.name as string || "Unknown",
        role: token.role as string || "unknown",
        feature: "settings",
        promptType: "test_connection",
        inputPreview: "Test connection with saved key",
        outputPreview: isConnected ? "Connected" : "Failed",
        status: isConnected ? "success" : "failed",
        errorMessage: isConnected ? undefined : "Connection test failed",
      });

      if (!isConnected) {
        return NextResponse.json({ ok: false, error: "Test connection failed. Please check your API key." }, { status: 400 });
      }

      return NextResponse.json({ ok: true, message: "Gemini API connected successfully." });
    } catch {
      return NextResponse.json({ ok: false, error: "Gemini API key is not configured. Please add it in AI Settings." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
