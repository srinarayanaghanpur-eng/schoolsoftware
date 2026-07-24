import { NextResponse } from "next/server";
import { employeeIdToInternalEmail, isValidRole, passwordResetRequestCreateSchema } from "@sri-narayana/shared";
import { adminDb } from "@/lib/firebaseAdmin";

export async function POST(req: Request) {
  try {
    const { loginId } = passwordResetRequestCreateSchema.parse(await req.json());
    const normalizedLoginId = loginId.trim().toUpperCase();
    const loginIdLower = normalizedLoginId.toLowerCase();
    const db = adminDb();

    const existing = await db
      .collection("password_reset_requests")
      .where("loginIdLower", "==", loginIdLower)
      .where("status", "==", "open")
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({
        ok: true,
        requestId: existing.docs[0].id,
        message: "A password request is already waiting for admin review."
      });
    }

    const teacherSnapshot = await db
      .collection("teachers")
      .where("employeeIdLower", "==", loginIdLower)
      .limit(1)
      .get();
    const teacherDoc = teacherSnapshot.docs[0];
    const teacher = teacherDoc?.data();

    const userSnapshot = teacherDoc
      ? null
      : await db
          .collection("users")
          .where("employeeId", "==", normalizedLoginId)
          .limit(1)
          .get();
    const userDoc = userSnapshot?.docs[0];
    const user = userDoc?.data();
    const internalEmail = employeeIdToInternalEmail(normalizedLoginId);
    const requestedAt = new Date().toISOString();
    const requestRef = db.collection("password_reset_requests").doc();

    await db.runTransaction(async (transaction) => {
      transaction.set(requestRef, {
        loginId: normalizedLoginId,
        loginIdLower,
        employeeId: typeof teacher?.employeeId === "string" ? teacher.employeeId : normalizedLoginId,
        internalEmail,
        teacherId: teacherDoc?.id ?? "",
        teacherName: typeof teacher?.fullName === "string" ? teacher.fullName : "",
        userId: !teacherDoc && userDoc ? userDoc.id : "",
        userName: !teacherDoc && typeof user?.displayName === "string" ? user.displayName : "",
        userRole: !teacherDoc && isValidRole(user?.role) ? user.role : "",
        targetType: teacherDoc ? "teacher" : userDoc ? "user" : "unknown",
        status: "open",
        requestedAt
      });
      transaction.set(db.collection("admin_notifications").doc(), {
        type: "password_reset_request",
        title: "Password reset request",
        message: `${normalizedLoginId} requested password help.`,
        relatedCollection: "password_reset_requests",
        relatedId: requestRef.id,
        status: "open",
        createdAt: requestedAt
      });
    });

    return NextResponse.json({
      ok: true,
      requestId: requestRef.id,
      message: "Password request sent to admin."
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create password request";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
