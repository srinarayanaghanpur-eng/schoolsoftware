import type { DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";
import { employeeIdToInternalEmail, isValidRole, passwordResetSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { errorMessage, requireAdmin, json } from "@/lib/apiUtils";

type RouteContext = { params: { requestId: string } };

type ResetTarget =
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

async function resolveResetTarget(request: Record<string, unknown>): Promise<ResetTarget> {
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

export async function POST(req: Request, { params }: RouteContext) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = passwordResetSchema.parse(body);
    const requestId = params.requestId.trim();
    if (!requestId) {
      return json({ ok: false, error: "Request ID is required" }, { status: 400 });
    }

    const db = adminDb();
    const requestRef = db.collection("password_reset_requests").doc(requestId);
    const requestSnapshot = await requestRef.get();
    if (!requestSnapshot.exists) {
      return json({ ok: false, error: "Password request not found" }, { status: 404 });
    }

    const requestData = requestSnapshot.data() as Record<string, unknown>;
    if (text(requestData.status).toLowerCase() !== "open") {
      return json({ ok: false, error: "This password request is already resolved." }, { status: 409 });
    }

    const target = await resolveResetTarget(requestData);
    if (target.role === "super_admin" && decodedToken.role !== "super_admin") {
      return json({ ok: false, error: "Only a super admin can reset a super admin password." }, { status: 403 });
    }

    const note = text(body.adminNote);
    const resetAt = new Date().toISOString();

    await adminAuth().updateUser(target.uid, { password: parsed.password });
    if (target.ref) {
      await target.ref.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    await db.collection("password_reset_history").add({
      targetType: target.type,
      targetUid: target.uid,
      teacherId: target.type === "teacher" ? target.teacherId : "",
      teacherName: target.type === "teacher" ? target.name : "",
      userId: target.type === "user" ? target.uid : "",
      userName: target.type === "user" ? target.name : "",
      userRole: target.role ?? "",
      employeeId: target.employeeId,
      resetBy: decodedToken.uid,
      resetAt,
      requestId,
      note
    });

    await requestRef.set(
      {
        status: "resolved",
        adminNote: note,
        resolvedAt: resetAt,
        resolvedBy: decodedToken.uid,
        targetUid: target.uid,
        targetType: target.type,
        updatedAt: resetAt,
        updatedBy: decodedToken.uid
      },
      { merge: true }
    );

    await db.collection("admin_audit_logs").add({
      action: target.type === "teacher" ? "teacher_password_reset" : "user_password_reset",
      targetType: target.type,
      targetUid: target.uid,
      teacherId: target.type === "teacher" ? target.teacherId : "",
      requestId,
      createdAt: resetAt,
      createdBy: decodedToken.uid
    });

    return json({ ok: true, message: "Password reset successfully." });
  } catch (error) {
    return json({ ok: false, error: errorMessage(error, "Unable to reset password") }, { status: 400 });
  }
}

