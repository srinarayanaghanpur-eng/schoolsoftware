import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { requirePermission } from "@/lib/apiUtils";
import { encrypt, maskApiKey, hasEncryptionKey } from "@/lib/ai/encryption";
import { testGeminiConnection } from "@/lib/ai/geminiClient";
import { getSchoolId } from "@/lib/schoolScope";
import { aiLog } from "@/lib/ai/aiLogger";
import { AI_PERMISSIONS } from "@/lib/ai/aiPermissions";
import { getQuotaSettings, saveQuotaSettings, DEFAULT_QUOTA_SETTINGS } from "@/lib/quota/usageLogger";

const SETTINGS_COLLECTION = "aiSettings";
const SETTINGS_DOC = "default-school";

export async function GET(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.VIEW);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied. Missing permission: ai_agent.view" }, { status: 403 });

    const schoolId = getSchoolId(token);
    const db = adminDb();
    const snapshot = await db.collection(SETTINGS_COLLECTION).doc(schoolId).get();

    if (!snapshot.exists) {
      return NextResponse.json({
        ok: true,
        data: {
          enabled: false,
          provider: "gemini",
          maskedApiKey: null,
          model: "gemini-2.5-flash",
          temperature: 0.7,
          maxOutputTokens: 1024,
          features: {
            feeReminder: true,
            noticeGenerator: true,
            reportSummary: true,
            studentSummary: true,
          },
        },
        encryptionKeyConfigured: hasEncryptionKey(),
        quota: DEFAULT_QUOTA_SETTINGS,
      });
    }

    const data = snapshot.data() as Record<string, unknown>;
    const features = (data.features as Record<string, boolean>) || {};
    const quota = await getQuotaSettings(schoolId);

    return NextResponse.json({
      ok: true,
      data: {
        enabled: Boolean(data.enabled),
        provider: data.provider || "gemini",
        maskedApiKey: data.maskedApiKey || null,
        model: data.model || "gemini-2.5-flash",
        temperature: typeof data.temperature === "number" ? data.temperature : 0.7,
        maxOutputTokens: typeof data.maxOutputTokens === "number" ? data.maxOutputTokens : 1024,
        features: {
          feeReminder: Boolean(features.feeReminder),
          noticeGenerator: Boolean(features.noticeGenerator),
          reportSummary: Boolean(features.reportSummary),
          studentSummary: Boolean(features.studentSummary),
        },
        quota,
      },
      encryptionKeyConfigured: hasEncryptionKey(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load AI settings";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const token = await requirePermission(req, AI_PERMISSIONS.SETTINGS);
    if (!token) return NextResponse.json({ ok: false, error: "Access denied. Missing permission: ai_agent.settings" }, { status: 403 });

    const body = await req.json();
    const schoolId = getSchoolId(token);

    if (body.action === "save") {
      if (!body.apiKey) {
        return NextResponse.json({ ok: false, error: "API key is required" }, { status: 400 });
      }

      if (!hasEncryptionKey()) {
        return NextResponse.json({
          ok: false,
          error: "AI_SECRET_ENCRYPTION_KEY environment variable is not configured. Please set it in .env.local to save API keys securely.",
        }, { status: 400 });
      }

      const isConnected = await testGeminiConnection(body.apiKey);
      if (!isConnected) {
        return NextResponse.json({ ok: false, error: "Test connection failed. Please check your API key." }, { status: 400 });
      }

      const encrypted = encrypt(body.apiKey);
      const masked = maskApiKey(body.apiKey);
      const db = adminDb();

      const existing = await db.collection(SETTINGS_COLLECTION).doc(schoolId).get();
      const now = FieldValue.serverTimestamp();

      if (!existing.exists) {
        await db.collection(SETTINGS_COLLECTION).doc(schoolId).set({
          enabled: true,
          provider: "gemini",
          encryptedApiKey: encrypted,
          maskedApiKey: masked,
          model: body.model || "gemini-2.5-flash",
          temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
          maxOutputTokens: typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : 1024,
          features: {
            feeReminder: body.features?.feeReminder !== false,
            noticeGenerator: body.features?.noticeGenerator !== false,
            reportSummary: body.features?.reportSummary !== false,
            studentSummary: body.features?.studentSummary !== false,
          },
          updatedBy: token.uid,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await db.collection(SETTINGS_COLLECTION).doc(schoolId).update({
          encryptedApiKey: encrypted,
          maskedApiKey: masked,
          model: body.model || "gemini-2.5-flash",
          temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
          maxOutputTokens: typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : 1024,
          features: {
            feeReminder: body.features?.feeReminder !== false,
            noticeGenerator: body.features?.noticeGenerator !== false,
            reportSummary: body.features?.reportSummary !== false,
            studentSummary: body.features?.studentSummary !== false,
          },
          updatedBy: token.uid,
          updatedAt: now,
        });
      }

      return NextResponse.json({
        ok: true,
        message: "AI settings saved successfully.",
        maskedApiKey: masked,
      });
    }

    if (body.action === "delete_key") {
      const db = adminDb();
      const existing = await db.collection(SETTINGS_COLLECTION).doc(schoolId).get();
      if (existing.exists) {
        await db.collection(SETTINGS_COLLECTION).doc(schoolId).update({
          encryptedApiKey: "",
          maskedApiKey: null,
          enabled: false,
          updatedBy: token.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return NextResponse.json({ ok: true, message: "API key deleted." });
    }

    if (body.action === "test") {
      const apiKey = body.apiKey;

      if (!apiKey) {
        return NextResponse.json({ ok: false, error: "API key is required" }, { status: 400 });
      }

      const isConnected = await testGeminiConnection(apiKey);

      await aiLog({
        schoolId,
        userId: token.uid,
        userName: token.name as string || "Unknown",
        role: token.role as string || "unknown",
        feature: "settings",
        promptType: "test_connection",
        inputPreview: "Test connection",
        outputPreview: isConnected ? "Connected" : "Failed",
        status: isConnected ? "success" : "failed",
        errorMessage: isConnected ? undefined : "Connection test failed",
      });

      if (!isConnected) {
        return NextResponse.json({ ok: false, error: "Connection test failed. Please check your API key." }, { status: 400 });
      }

      return NextResponse.json({ ok: true, message: "Gemini API connected successfully." });
    }

    if (body.action === "save_quota") {
      await saveQuotaSettings(schoolId, {
        firebaseDailyReadSoftLimit: Number(body.firebaseDailyReadSoftLimit) || DEFAULT_QUOTA_SETTINGS.firebaseDailyReadSoftLimit,
        firebaseDailyWriteSoftLimit: Number(body.firebaseDailyWriteSoftLimit) || DEFAULT_QUOTA_SETTINGS.firebaseDailyWriteSoftLimit,
        geminiDailyRequestLimit: Number(body.geminiDailyRequestLimit) || DEFAULT_QUOTA_SETTINGS.geminiDailyRequestLimit,
        geminiDailyTokenLimit: Number(body.geminiDailyTokenLimit) || DEFAULT_QUOTA_SETTINGS.geminiDailyTokenLimit,
        perUserDailyAiLimit: Number(body.perUserDailyAiLimit) || DEFAULT_QUOTA_SETTINGS.perUserDailyAiLimit,
        cacheTtlMinutes: Number(body.cacheTtlMinutes) || DEFAULT_QUOTA_SETTINGS.cacheTtlMinutes,
        enableSaverMode: body.enableSaverMode !== false,
        enableEmergencyMode: body.enableEmergencyMode !== false,
        disableAiWhenQuotaHigh: body.disableAiWhenQuotaHigh !== false,
        disableAutoSummariesWhenQuotaHigh: body.disableAutoSummariesWhenQuotaHigh !== false,
        disableBulkAiWhenQuotaHigh: body.disableBulkAiWhenQuotaHigh !== false,
        saverModeThresholdPercent: Number(body.saverModeThresholdPercent) || DEFAULT_QUOTA_SETTINGS.saverModeThresholdPercent,
      });

      return NextResponse.json({ ok: true, message: "Quota settings saved." });
    }

    if (body.action === "update_settings") {
      const db = adminDb();
      const existing = await db.collection(SETTINGS_COLLECTION).doc(schoolId).get();

      const updateData: Record<string, unknown> = {
        model: body.model || "gemini-2.5-flash",
        temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
        maxOutputTokens: typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : 1024,
        features: {
          feeReminder: body.features?.feeReminder !== false,
          noticeGenerator: body.features?.noticeGenerator !== false,
          reportSummary: body.features?.reportSummary !== false,
          studentSummary: body.features?.studentSummary !== false,
        },
        updatedBy: token.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (body.enabled !== undefined) {
        updateData.enabled = Boolean(body.enabled);
      }

      if (existing.exists) {
        await db.collection(SETTINGS_COLLECTION).doc(schoolId).update(updateData);
      }

      return NextResponse.json({ ok: true, message: "Settings updated." });
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update AI settings";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
