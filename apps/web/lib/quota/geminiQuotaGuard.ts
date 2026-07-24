import "server-only";
import { getDailyUsage, getQuotaSettings, getCurrentQuotaMode, incrementDailyUsage, incrementUserUsage, type QuotaMode } from "./usageLogger";

export type QuotaCheckResult = {
  allowed: boolean;
  mode: QuotaMode;
  message?: string;
};

export async function checkGeminiQuota(params: {
  schoolId: string;
  userId: string;
  userName: string;
  role: string;
  feature: string;
  estimatedInputTokens?: number;
}): Promise<QuotaCheckResult> {
  const mode = await getCurrentQuotaMode(params.schoolId);
  const settings = await getQuotaSettings(params.schoolId);
  const usage = await getDailyUsage(params.schoolId);

  if (mode === "emergency") {
    return {
      allowed: false,
      mode,
      message: "Gemini free-tier limit is reached or saver mode is active. Showing cached response if available.",
    };
  }

  if (settings.geminiDailyRequestLimit > 0 && usage.geminiRequests >= settings.geminiDailyRequestLimit) {
    return {
      allowed: false,
      mode,
      message: "Gemini daily request limit reached. Please try again tomorrow or check cached responses.",
    };
  }

  if (settings.geminiDailyTokenLimit > 0 && usage.estimatedInputTokens >= settings.geminiDailyTokenLimit) {
    return {
      allowed: false,
      mode,
      message: "Gemini daily token limit reached. Please try again tomorrow.",
    };
  }

  if (settings.perUserDailyAiLimit > 0) {
    const userUsage = await getUserTodayUsage(params.schoolId, params.userId);
    if (userUsage >= settings.perUserDailyAiLimit) {
      return {
        allowed: false,
        mode,
        message: `Your daily AI usage limit (${settings.perUserDailyAiLimit}) has been reached. Please try again tomorrow.`,
      };
    }
  }

  if (settings.perRoleDailyAiLimit > 0) {
    const roleLimit = getRoleLimit(params.role, settings.perRoleDailyAiLimit);
    if (usage.totalAiCalls >= roleLimit) {
      return {
        allowed: false,
        mode,
        message: `Daily AI limit for ${params.role} role has been reached. Please try again tomorrow.`,
      };
    }
  }

  return { allowed: true, mode };
}

function getRoleLimit(role: string, defaultLimit: number): number {
  const limits: Record<string, number> = {
    super_admin: defaultLimit * 2,
    admin: defaultLimit,
    accountant: Math.floor(defaultLimit * 0.6),
    principal: Math.floor(defaultLimit * 0.6),
    teacher: Math.floor(defaultLimit * 0.2),
  };
  return limits[role] || defaultLimit;
}

async function getUserTodayUsage(schoolId: string, userId: string): Promise<number> {
  try {
    const dateStr = todayDateString();
    const { adminDb } = await import("@/lib/firebaseAdmin");
    const db = adminDb();
    const snap = await db.collection("aiUserUsageDaily").doc(`${schoolId}_${userId}_${dateStr}`).get();
    if (snap.exists) {
      const d = snap.data() as Record<string, unknown>;
      return Number(d.aiCalls) || 0;
    }
  } catch {
    // fall through
  }
  return 0;
}

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function recordGeminiCall(params: {
  schoolId: string;
  userId: string;
  userName: string;
  role: string;
  feature: string;
  inputTokens?: number;
  outputTokens?: number;
  success: boolean;
}): Promise<void> {
  await incrementDailyUsage(params.schoolId, "gemini_requests", 1);
  await incrementDailyUsage(params.schoolId, params.success ? "total_ai_calls" : "failed_calls", 1);
  await incrementUserUsage({
    schoolId: params.schoolId,
    userId: params.userId,
    userName: params.userName,
    role: params.role,
    feature: params.feature,
  });
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncatePrompt(prompt: string, maxTokens: number): string {
  const maxChars = maxTokens * 4;
  if (prompt.length <= maxChars) return prompt;
  return prompt.slice(0, maxChars) + "\n\n[Content truncated due to length limits]";
}
