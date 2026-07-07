import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export type QuotaMode = "normal" | "saver" | "emergency";

export type QuotaSettings = {
  firebaseDailyReadSoftLimit: number;
  firebaseDailyWriteSoftLimit: number;
  geminiDailyRequestLimit: number;
  geminiDailyTokenLimit: number;
  perUserDailyAiLimit: number;
  perRoleDailyAiLimit: number;
  cacheTtlMinutes: number;
  enableSaverMode: boolean;
  enableEmergencyMode: boolean;
  disableAiWhenQuotaHigh: boolean;
  disableAutoSummariesWhenQuotaHigh: boolean;
  disableBulkAiWhenQuotaHigh: boolean;
  saverModeThresholdPercent: number;
};

export const DEFAULT_QUOTA_SETTINGS: QuotaSettings = {
  firebaseDailyReadSoftLimit: 40000,
  firebaseDailyWriteSoftLimit: 15000,
  geminiDailyRequestLimit: 50,
  geminiDailyTokenLimit: 100000,
  perUserDailyAiLimit: 20,
  perRoleDailyAiLimit: 50,
  cacheTtlMinutes: 60,
  enableSaverMode: true,
  enableEmergencyMode: true,
  disableAiWhenQuotaHigh: true,
  disableAutoSummariesWhenQuotaHigh: true,
  disableBulkAiWhenQuotaHigh: true,
  saverModeThresholdPercent: 80,
};

export const ROLE_DAILY_LIMITS: Record<string, number> = {
  super_admin: 100,
  admin: 50,
  accountant: 30,
  principal: 30,
  teacher: 10,
};

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getQuotaSettings(schoolId: string): Promise<QuotaSettings> {
  try {
    const db = adminDb();
    const snap = await db.collection("quotaSettings").doc(schoolId).get();
    if (snap.exists) {
      const data = snap.data() as Record<string, unknown>;
      return {
        firebaseDailyReadSoftLimit: Number(data.firebaseDailyReadSoftLimit) || DEFAULT_QUOTA_SETTINGS.firebaseDailyReadSoftLimit,
        firebaseDailyWriteSoftLimit: Number(data.firebaseDailyWriteSoftLimit) || DEFAULT_QUOTA_SETTINGS.firebaseDailyWriteSoftLimit,
        geminiDailyRequestLimit: Number(data.geminiDailyRequestLimit) || DEFAULT_QUOTA_SETTINGS.geminiDailyRequestLimit,
        geminiDailyTokenLimit: Number(data.geminiDailyTokenLimit) || DEFAULT_QUOTA_SETTINGS.geminiDailyTokenLimit,
        perUserDailyAiLimit: Number(data.perUserDailyAiLimit) || DEFAULT_QUOTA_SETTINGS.perUserDailyAiLimit,
        perRoleDailyAiLimit: Number(data.perRoleDailyAiLimit) || DEFAULT_QUOTA_SETTINGS.perRoleDailyAiLimit,
        cacheTtlMinutes: Number(data.cacheTtlMinutes) || DEFAULT_QUOTA_SETTINGS.cacheTtlMinutes,
        enableSaverMode: data.enableSaverMode !== false,
        enableEmergencyMode: data.enableEmergencyMode !== false,
        disableAiWhenQuotaHigh: data.disableAiWhenQuotaHigh !== false,
        disableAutoSummariesWhenQuotaHigh: data.disableAutoSummariesWhenQuotaHigh !== false,
        disableBulkAiWhenQuotaHigh: data.disableBulkAiWhenQuotaHigh !== false,
        saverModeThresholdPercent: Number(data.saverModeThresholdPercent) || DEFAULT_QUOTA_SETTINGS.saverModeThresholdPercent,
      };
    }
  } catch {
    // return defaults
  }
  return { ...DEFAULT_QUOTA_SETTINGS };
}

export async function saveQuotaSettings(schoolId: string, settings: Partial<QuotaSettings>): Promise<void> {
  const db = adminDb();
  await db.collection("quotaSettings").doc(schoolId).set(
    {
      ...settings,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function incrementDailyUsage(
  schoolId: string,
  type: "gemini_requests" | "firebase_reads" | "firebase_writes" | "cache_hits" | "cache_misses" | "failed_calls" | "total_ai_calls",
  count = 1
): Promise<void> {
  try {
    const dateStr = todayDateString();
    const db = adminDb();
    const ref = db.collection("aiUsageDaily").doc(`${schoolId}_${dateStr}`);
    await ref.set(
      {
        date: dateStr,
        schoolId,
        [type]: FieldValue.increment(count),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // silently fail - logging should not break the app
  }
}

export async function incrementUserUsage(params: {
  schoolId: string;
  userId: string;
  userName: string;
  role: string;
  feature: string;
}): Promise<void> {
  try {
    const dateStr = todayDateString();
    const db = adminDb();
    const docId = `${params.schoolId}_${params.userId}_${dateStr}`;
    const ref = db.collection("aiUserUsageDaily").doc(docId);
    await ref.set(
      {
        userId: params.userId,
        userName: params.userName,
        role: params.role,
        date: dateStr,
        schoolId: params.schoolId,
        aiCalls: FieldValue.increment(1),
        [`featureCounts.${params.feature}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // silently fail
  }
}

export async function getDailyUsage(schoolId: string): Promise<{
  geminiRequests: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  totalAiCalls: number;
  cacheHits: number;
  cacheMisses: number;
  failedCalls: number;
  firebaseReads: number;
  firebaseWrites: number;
}> {
  const dateStr = todayDateString();
  const db = adminDb();
  const snap = await db.collection("aiUsageDaily").doc(`${schoolId}_${dateStr}`).get();
  if (!snap.exists) {
    return {
      geminiRequests: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      totalAiCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      failedCalls: 0,
      firebaseReads: 0,
      firebaseWrites: 0,
    };
  }
  const d = snap.data() as Record<string, unknown>;
  return {
    geminiRequests: Number(d.geminiRequests) || 0,
    estimatedInputTokens: Number(d.estimatedInputTokens) || 0,
    estimatedOutputTokens: Number(d.estimatedOutputTokens) || 0,
    totalAiCalls: Number(d.totalAiCalls) || 0,
    cacheHits: Number(d.cacheHits) || 0,
    cacheMisses: Number(d.cacheMisses) || 0,
    failedCalls: Number(d.failedCalls) || 0,
    firebaseReads: Number(d.firebaseReads) || 0,
    firebaseWrites: Number(d.firebaseWrites) || 0,
  };
}

export async function getTodayUsageByUser(schoolId: string): Promise<Array<{ userId: string; userName: string; role: string; aiCalls: number; featureCounts: Record<string, number> }>> {
  const dateStr = todayDateString();
  const db = adminDb();
  const snap = await db
    .collection("aiUserUsageDaily")
    .where("schoolId", "==", schoolId)
    .where("date", "==", dateStr)
    .limit(50)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data() as Record<string, unknown>;
    return {
      userId: String(d.userId || ""),
      userName: String(d.userName || "Unknown"),
      role: String(d.role || ""),
      aiCalls: Number(d.aiCalls) || 0,
      featureCounts: (d.featureCounts as Record<string, number>) || {},
    };
  });
}

export async function getTodayUsageByFeature(schoolId: string): Promise<Record<string, number>> {
  const dateStr = todayDateString();
  const db = adminDb();
  const snap = await db
    .collection("aiUserUsageDaily")
    .where("schoolId", "==", schoolId)
    .where("date", "==", dateStr)
    .limit(100)
    .get();
  const featureMap: Record<string, number> = {};
  snap.docs.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const counts = (d.featureCounts as Record<string, number>) || {};
    for (const [feature, count] of Object.entries(counts)) {
      featureMap[feature] = (featureMap[feature] || 0) + count;
    }
  });
  return featureMap;
}

export async function getCurrentQuotaMode(schoolId: string): Promise<QuotaMode> {
  try {
    const usage = await getDailyUsage(schoolId);
    const settings = await getQuotaSettings(schoolId);

    const firebaseReadPercent = settings.firebaseDailyReadSoftLimit > 0
      ? (usage.firebaseReads / settings.firebaseDailyReadSoftLimit) * 100
      : 0;
    const firebaseWritePercent = settings.firebaseDailyWriteSoftLimit > 0
      ? (usage.firebaseWrites / settings.firebaseDailyWriteSoftLimit) * 100
      : 0;
    const geminiPercent = settings.geminiDailyRequestLimit > 0
      ? (usage.geminiRequests / settings.geminiDailyRequestLimit) * 100
      : 0;
    const threshold = settings.saverModeThresholdPercent || 80;

    if (usage.failedCalls > 10 && settings.enableEmergencyMode) {
      return "emergency";
    }
    if (
      settings.enableSaverMode &&
      (firebaseReadPercent >= 100 || firebaseWritePercent >= 100 || geminiPercent >= 100)
    ) {
      return "emergency";
    }
    if (
      settings.enableSaverMode &&
      (firebaseReadPercent >= threshold || firebaseWritePercent >= threshold || geminiPercent >= threshold)
    ) {
      return "saver";
    }
    return "normal";
  } catch {
    return "normal";
  }
}
