import "server-only";
import { adminDb } from "@/lib/firebaseAdmin";
import { incrementDailyUsage, getQuotaSettings, getCurrentQuotaMode, getDailyUsage } from "./usageLogger";

type SafeQueryOptions = {
  schoolId: string;
  feature: string;
  maxDocs?: number;
};

async function checkReadQuota(schoolId: string, estimatedReads: number): Promise<boolean> {
  const settings = await getQuotaSettings(schoolId);
  if (settings.disableAiWhenQuotaHigh) {
    const usage = await getDailyUsage(schoolId);
    const projected = usage.firebaseReads + estimatedReads;
    if (projected >= settings.firebaseDailyReadSoftLimit) {
      return false;
    }
  }
  return true;
}

export async function checkQuotaBeforeOp(schoolId: string, estimatedReads = 1): Promise<{ allowed: boolean; mode: string; message?: string }> {
  const mode = await getCurrentQuotaMode(schoolId);
  if (mode === "emergency") {
    return { allowed: false, mode, message: "Quota protection active. Live AI is paused. Cached data is being shown." };
  }
  if (mode === "saver") {
    const ok = await checkReadQuota(schoolId, estimatedReads);
    if (!ok) {
      return { allowed: false, mode, message: "Saver Mode active. Heavy AI data loading is paused to protect Firebase quota." };
    }
  }
  return { allowed: true, mode };
}

export async function safeGetDoc(params: {
  collection: string;
  docId: string;
  schoolId: string;
  feature: string;
}): Promise<{ data: Record<string, unknown> | null; exists: boolean; fromCache: boolean }> {
  const mode = await getCurrentQuotaMode(params.schoolId);
  if (mode === "emergency") {
    return { data: null, exists: false, fromCache: false };
  }
  const db = adminDb();
  const snap = await db.collection(params.collection).doc(params.docId).get();
  await incrementDailyUsage(params.schoolId, "firebase_reads", 1);
  if (!snap.exists) return { data: null, exists: false, fromCache: false };
  return { data: snap.data() as Record<string, unknown>, exists: true, fromCache: false };
}

export async function safeGetDocs(params: {
  collection: string;
  schoolId: string;
  feature: string;
  constraints?: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }>;
  limit?: number;
  orderBy?: { field: string; direction?: "asc" | "desc" };
}): Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }>; fromCache: boolean }> {
  const maxDocs = params.limit || 25;
  const mode = await getCurrentQuotaMode(params.schoolId);
  if (mode === "emergency") {
    return { docs: [], fromCache: false };
  }
  if (mode === "saver") {
    const ok = await checkReadQuota(params.schoolId, maxDocs);
    if (!ok) {
      return { docs: [], fromCache: false };
    }
  }
  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection(params.collection);
  if (params.constraints) {
    for (const c of params.constraints) {
      query = query.where(c.field, c.op, c.value);
    }
  }
  if (params.orderBy) {
    query = query.orderBy(params.orderBy.field, params.orderBy.direction || "asc");
  }
  query = query.limit(Math.min(maxDocs, 50));
  const snapshot = await query.get();
  await incrementDailyUsage(params.schoolId, "firebase_reads", snapshot.docs.length || 1);
  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: () => doc.data() as Record<string, unknown>,
  }));
  return { docs, fromCache: false };
}

export async function safeSetDoc(params: {
  collection: string;
  docId: string;
  data: Record<string, unknown>;
  schoolId: string;
  feature: string;
}): Promise<void> {
  const mode = await getCurrentQuotaMode(params.schoolId);
  if (mode === "emergency") {
    throw new Error("Firebase write quota protection active. Cannot write data.");
  }
  const db = adminDb();
  await db.collection(params.collection).doc(params.docId).set(params.data, { merge: true });
  await incrementDailyUsage(params.schoolId, "firebase_writes", 1);
}

export async function safeUpdateDoc(params: {
  collection: string;
  docId: string;
  data: Record<string, unknown>;
  schoolId: string;
  feature: string;
}): Promise<void> {
  const mode = await getCurrentQuotaMode(params.schoolId);
  if (mode === "emergency") {
    throw new Error("Firebase write quota protection active. Cannot update data.");
  }
  const db = adminDb();
  await db.collection(params.collection).doc(params.docId).update(params.data);
  await incrementDailyUsage(params.schoolId, "firebase_writes", 1);
}

export async function safeAddDoc(params: {
  collection: string;
  data: Record<string, unknown>;
  schoolId: string;
  feature: string;
}): Promise<string> {
  const mode = await getCurrentQuotaMode(params.schoolId);
  if (mode === "emergency") {
    throw new Error("Firebase write quota protection active. Cannot create document.");
  }
  const db = adminDb();
  const ref = await db.collection(params.collection).add(params.data);
  await incrementDailyUsage(params.schoolId, "firebase_writes", 1);
  return ref.id;
}

export async function getFeeDueSummary(schoolId: string, academicYearId: string): Promise<Record<string, unknown> | null> {
  const db = adminDb();
  const docId = `${schoolId}_${academicYearId}`;
  try {
    const snap = await db.collection("feeDueSummary").doc(docId).get();
    if (snap.exists) {
      return snap.data() as Record<string, unknown>;
    }
  } catch {
    // not found
  }
  return null;
}

export async function buildFeeDueSummary(schoolId: string, academicYearId: string): Promise<Record<string, unknown>> {
  const db = adminDb();
  const dueSnap = await db
    .collection("fee_dues")
    .where("status", "==", "pending")
    .limit(500)
    .get();

  let totalDueAmount = 0;
  const studentIds = new Set<string>();
  const classWiseDue: Record<string, { count: number; total: number }> = {};
  const feeTypeWiseDue: Record<string, number> = {};

  dueSnap.docs.forEach((doc) => {
    const d = doc.data() as Record<string, unknown>;
    const amount = Number(d.amount || d.dueAmount || 0);
    const cls = String(d.className || d.class || "Unknown");
    const feeType = String(d.feeType || "Fee");
    const studentId = String(d.studentId || "");

    totalDueAmount += amount;
    if (studentId) studentIds.add(studentId);

    if (!classWiseDue[cls]) classWiseDue[cls] = { count: 0, total: 0 };
    classWiseDue[cls].count += 1;
    classWiseDue[cls].total += amount;

    feeTypeWiseDue[feeType] = (feeTypeWiseDue[feeType] || 0) + amount;
  });

  const summary = {
    totalDueStudents: studentIds.size,
    totalDueAmount,
    classWiseDue,
    feeTypeWiseDue,
    updatedAt: new Date().toISOString(),
  };

  const docId = `${schoolId}_${academicYearId}`;
  await db.collection("feeDueSummary").doc(docId).set(summary, { merge: true });

  return summary;
}
