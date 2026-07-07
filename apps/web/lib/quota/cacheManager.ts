import "server-only";
import crypto from "crypto";
import { adminDb } from "@/lib/firebaseAdmin";
import { getQuotaSettings, incrementDailyUsage } from "./usageLogger";

type CacheEntry = {
  key: string;
  inputHash: string;
  output: string;
  feature: string;
  schoolId: string;
  hitCount: number;
  createdAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
};

function hashInput(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export async function getCachedResponse(params: {
  schoolId: string;
  input: string;
  feature: string;
  ttlMinutes?: number;
}): Promise<{ output: string | null; hitCount: number }> {
  try {
    const inputHash = hashInput(params.input);
    const key = `${params.feature}_${inputHash}`;
    const db = adminDb();
    const snap = await db.collection("aiCache").doc(key).get();

    if (!snap.exists) {
      return { output: null, hitCount: 0 };
    }

    const data = snap.data() as Record<string, unknown>;
    const expiresAt = data.expiresAt as FirebaseFirestore.Timestamp;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (expiresAt && expiresAt.seconds < nowSeconds) {
      await db.collection("aiCache").doc(key).delete().catch(() => {});
      return { output: null, hitCount: 0 };
    }

    const hitCount = (Number(data.hitCount) || 0) + 1;
    await db
      .collection("aiCache")
      .doc(key)
      .update({ hitCount, lastAccessedAt: new Date().toISOString() })
      .catch(() => {});

    await incrementDailyUsage(params.schoolId, "cache_hits", 1);

    return { output: String(data.output || ""), hitCount: hitCount - 1 };
  } catch {
    return { output: null, hitCount: 0 };
  }
}

export async function setCachedResponse(params: {
  schoolId: string;
  input: string;
  output: string;
  feature: string;
  ttlMinutes?: number;
}): Promise<void> {
  try {
    const settings = await getQuotaSettings(params.schoolId);
    const ttl = params.ttlMinutes || settings.cacheTtlMinutes || 60;
    const inputHash = hashInput(params.input);
    const key = `${params.feature}_${inputHash}`;
    const db = adminDb();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttl * 60 * 1000);

    await db.collection("aiCache").doc(key).set({
      key,
      inputHash,
      output: params.output,
      feature: params.feature,
      schoolId: params.schoolId,
      hitCount: 0,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    await incrementDailyUsage(params.schoolId, "cache_misses", 1);
  } catch {
    // silently fail
  }
}

export async function clearAiCache(schoolId?: string): Promise<void> {
  const db = adminDb();
  if (schoolId) {
    const snap = await db.collection("aiCache").where("schoolId", "==", schoolId).get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  } else {
    const snap = await db.collection("aiCache").get();
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function getCacheStats(schoolId: string): Promise<{
  totalEntries: number;
  totalHits: number;
  hitRate: number;
}> {
  const db = adminDb();
  const snap = await db
    .collection("aiCache")
    .where("schoolId", "==", schoolId)
    .limit(200)
    .get();

  let totalHits = 0;
  let expired = 0;

  snap.docs.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    totalHits += Number(d.hitCount) || 0;
    const expiresAt = d.expiresAt as string;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      expired++;
    }
  });

  const active = snap.docs.length - expired;
  return {
    totalEntries: active,
    totalHits,
    hitRate: totalHits > 0 && snap.docs.length > 0 ? totalHits / snap.docs.length : 0,
  };
}

export function getCacheTtlForFeature(feature: string): number {
  const ttlMap: Record<string, number> = {
    dues_summary: 30,
    fee_reminder: 24 * 60,
    notice_generator: 24 * 60,
    chat: 10,
    parent_message: 60,
    teacher_message: 60,
    report_explainer: 60,
  };
  return ttlMap[feature] || 60;
}
