import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";

export type AiLogEntry = {
  schoolId: string;
  userId: string;
  userName: string;
  role: string;
  feature: string;
  promptType: string;
  inputPreview: string;
  outputPreview: string;
  status: "success" | "failed";
  errorMessage?: string;
  createdAt: FirebaseFirestore.FieldValue;
};

export async function aiLog(entry: Omit<AiLogEntry, "createdAt">): Promise<void> {
  try {
    const db = adminDb();
    await db.collection("aiLogs").add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[aiLogger] Failed to write log:", error);
  }
}

export async function getAiLogs(params: {
  schoolId: string;
  limit?: number;
  cursor?: string;
  feature?: string;
  status?: string;
}): Promise<{ logs: Array<Record<string, unknown>>; nextCursor: string | null }> {
  const db = adminDb();
  let query: FirebaseFirestore.Query = db.collection("aiLogs").where("schoolId", "==", params.schoolId);

  if (params.feature) {
    query = query.where("feature", "==", params.feature);
  }
  if (params.status) {
    query = query.where("status", "==", params.status);
  }

  query = query.orderBy("createdAt", "desc");

  const pageSize = Math.min(params.limit || 25, 100);

  if (params.cursor) {
    const cursorDoc = await db.collection("aiLogs").doc(params.cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.limit(pageSize + 1).get();
  const logs = snapshot.docs.slice(0, pageSize).map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const nextCursor = snapshot.docs.length > pageSize ? snapshot.docs[pageSize - 1].id : null;

  return { logs, nextCursor };
}
