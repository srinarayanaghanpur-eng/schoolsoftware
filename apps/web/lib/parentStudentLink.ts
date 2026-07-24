import { adminDb } from "@/lib/firebaseAdmin";
import type { ParentStudentLink } from "@sri-narayana/shared";

export async function linkParentToStudent(
  parentUid: string,
  studentId: string,
  relationship: "father" | "mother" | "guardian" | "other",
  isPrimary: boolean
): Promise<string> {
  const docRef = adminDb().collection("parent_student_links").doc();
  const link: ParentStudentLink = {
    parentUid,
    studentId,
    relationship,
    isPrimary,
    createdAt: new Date().toISOString()
  };
  await docRef.set(link);
  return docRef.id;
}

export async function unlinkParentFromStudent(linkId: string): Promise<void> {
  await adminDb().collection("parent_student_links").doc(linkId).delete();
}

export async function getStudentsForParent(parentUid: string): Promise<ParentStudentLink[]> {
  const snapshot = await adminDb()
    .collection("parent_student_links")
    .where("parentUid", "==", parentUid)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ParentStudentLink));
}

export async function getParentsForStudent(studentId: string): Promise<ParentStudentLink[]> {
  const snapshot = await adminDb()
    .collection("parent_student_links")
    .where("studentId", "==", studentId)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ParentStudentLink));
}
