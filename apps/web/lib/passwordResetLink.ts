import type { DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
import { employeeIdToInternalEmail, isValidRole } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export type ResetTarget =
  | {
      type: "teacher";
      uid: string;
      ref: DocumentReference;
      name: string;
      employeeId: string;
      role?: string;
      teacherId: string;
    }
  | {
      type: "user";
      uid: string;
      ref: DocumentReference | null;
      name: string;
      employeeId: string;
      role?: string;
    };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function userDocByLoginId(loginId: string): Promise<DocumentSnapshot | null> {
  const normalizedLoginId = loginId.trim().toUpperCase();
  if (!normalizedLoginId) return null;

  const db = adminDb();
  const byEmployeeId = await db.collection("users").where("employeeId", "==", normalizedLoginId).limit(1).get();
  if (!byEmployeeId.empty) return byEmployeeId.docs[0];

  const byInternalEmail = await db
    .collection("users")
    .where("internalEmail", "==", employeeIdToInternalEmail(normalizedLoginId))
    .limit(1)
    .get();
  return byInternalEmail.docs[0] ?? null;
}

/** Resolve a password_reset_requests doc to the Firebase Auth uid to reset. */
export async function resolveResetTarget(request: Record<string, unknown>): Promise<ResetTarget> {
  const db = adminDb();
  const teacherId = text(request.teacherId);

  if (teacherId) {
    const ref = db.collection("teachers").doc(teacherId);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error("Teacher not found for this password request");

    const data = snapshot.data();
    const uid = text(data?.uid);
    if (!uid) throw new Error("Teacher Auth user is missing");

    return {
      type: "teacher",
      uid,
      ref,
      teacherId,
      name: text(data?.fullName),
      employeeId: text(data?.employeeId || request.employeeId || request.loginId),
      role: "teacher"
    };
  }

  const userId = text(request.userId || request.uid);
  let userRef: DocumentReference | null = userId ? db.collection("users").doc(userId) : null;
  let userSnapshot = userRef ? await userRef.get() : null;

  if (!userSnapshot?.exists) {
    userSnapshot = await userDocByLoginId(text(request.loginId || request.employeeId));
    userRef = userSnapshot?.exists ? userSnapshot.ref : null;
  }

  const userData = userSnapshot?.exists ? userSnapshot.data() : undefined;
  const uid = text(userData?.uid || userSnapshot?.id || userId);
  if (uid) {
    return {
      type: "user",
      uid,
      ref: userRef,
      name: text(userData?.displayName || request.userName || request.loginId),
      employeeId: text(userData?.employeeId || request.employeeId || request.loginId),
      role: isValidRole(userData?.role) ? userData.role : text(request.userRole)
    };
  }

  const loginId = text(request.loginId || request.employeeId);
  if (!loginId) throw new Error("This password request has no login ID");

  const authUser = await adminAuth().getUserByEmail(employeeIdToInternalEmail(loginId));
  return {
    type: "user",
    uid: authUser.uid,
    ref: null,
    name: authUser.displayName || loginId,
    employeeId: loginId.toUpperCase(),
    role: isValidRole(authUser.customClaims?.role) ? authUser.customClaims.role : undefined
  };
}

/** Base URL for the NarayanaOS reset page (no invented domains). */
export function resetPageBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Generate a Firebase password-reset link for the target Auth user.
 * The link opens Firebase's handler and continues to /reset-password with the
 * oobCode. No password is created, stored, or emailed by us. The continue URL
 * domain must be in Firebase Console > Authentication > Settings >
 * Authorized domains (localhost is authorized by default).
 */
export async function generateResetLinkForUid(uid: string): Promise<string> {
  const user = await adminAuth().getUser(uid);
  if (!user.email) throw new Error("Auth user has no email address");
  return adminAuth().generatePasswordResetLink(user.email, {
    url: `${resetPageBaseUrl()}/reset-password`,
    handleCodeInApp: true
  });
}
