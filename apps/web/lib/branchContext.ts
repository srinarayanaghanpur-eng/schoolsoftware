import { adminDb } from "@/lib/firebaseAdmin";
import type { BranchInfo } from "@sri-narayana/shared";

export async function getBranches(): Promise<BranchInfo[]> {
  const snapshot = await adminDb()
    .collection("branches")
    .orderBy("name", "asc")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as BranchInfo));
}

export async function getActiveBranches(): Promise<BranchInfo[]> {
  const snapshot = await adminDb()
    .collection("branches")
    .where("isActive", "==", true)
    .orderBy("name", "asc")
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as BranchInfo));
}

export async function getBranchById(id: string): Promise<BranchInfo | null> {
  const snap = await adminDb().collection("branches").doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as BranchInfo;
}

export async function createBranch(data: Omit<BranchInfo, "id" | "createdAt" | "updatedAt">): Promise<string> {
  const docRef = adminDb().collection("branches").doc();
  const now = new Date().toISOString();
  await docRef.set({
    ...data,
    createdAt: now,
    updatedAt: now
  });
  return docRef.id;
}

export async function updateBranch(id: string, data: Partial<BranchInfo>): Promise<void> {
  await adminDb().collection("branches").doc(id).update({
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export function scopeQueryByBranch<T extends { branch?: string }>(
  query: FirebaseFirestore.Query,
  branchId?: string
): FirebaseFirestore.Query {
  if (branchId) {
    return query.where("branch", "==", branchId);
  }
  return query;
}
