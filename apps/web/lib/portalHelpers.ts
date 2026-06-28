import { adminDb } from "@/lib/firebaseAdmin";
import { getStudentsForParent } from "@/lib/parentStudentLink";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function getLinkedStudentIds(token: DecodedIdToken): Promise<string[]> {
  const links = await getStudentsForParent(token.uid);
  return links.map((l) => l.studentId);
}

export async function verifyStudentLinked(token: DecodedIdToken, studentId: string): Promise<boolean> {
  const links = await getStudentsForParent(token.uid);
  return links.some((l) => l.studentId === studentId);
}

export async function verifyAndGetStudent(token: DecodedIdToken, studentId: string) {
  const linked = await verifyStudentLinked(token, studentId);
  if (!linked) return null;
  const snap = await adminDb().collection("students").doc(studentId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Record<string, unknown>;
}

export async function getPortalLinkedStudents(token: DecodedIdToken) {
  const links = await getStudentsForParent(token.uid);
  const ids = links.map((l) => l.studentId);
  if (ids.length === 0) return [];
  const snaps = await Promise.all(ids.map((id) => adminDb().collection("students").doc(id).get()));
  return snaps
    .filter((s) => s.exists)
    .map((s) => {
      const d = s.data() as Record<string, unknown>;
      return { id: s.id, name: String(d.studentName || ""), className: String(d.class || ""), section: String(d.section || "") };
    });
}
