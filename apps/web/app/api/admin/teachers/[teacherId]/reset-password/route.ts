import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { passwordResetSchema } from "@sri-narayana/shared";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/apiUtils";

export async function POST(req: Request, { params }: { params: { teacherId: string } }) {
  try {
    const decodedToken = await requireAdmin(req);
    if (!decodedToken) {
      return NextResponse.json({ ok: false, error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = passwordResetSchema.parse(body);
    const docRef = adminDb().collection("teachers").doc(params.teacherId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      return NextResponse.json({ ok: false, error: "Teacher not found" }, { status: 404 });
    }

    const teacherData = snapshot.data();
    const uid = teacherData?.uid;
    if (typeof uid !== "string") {
      throw new Error("Teacher Auth user is missing");
    }

    await adminAuth().updateUser(uid, { password: parsed.password });
    await docRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
    const note = typeof body.adminNote === "string" ? body.adminNote.trim() : "";
    const resetAt = new Date().toISOString();
    const db = adminDb();
    await db.collection("password_reset_history").add({
      teacherId: params.teacherId,
      teacherName: String(teacherData?.fullName ?? ""),
      employeeId: String(teacherData?.employeeId ?? ""),
      resetBy: decodedToken.uid,
      resetAt,
      requestId,
      note
    });
    if (requestId) {
      await db.collection("password_reset_requests").doc(requestId).set(
        {
          status: "resolved",
          adminNote: note,
          resolvedAt: resetAt,
          resolvedBy: decodedToken.uid
        },
        { merge: true }
      );
    }
    await db.collection("admin_audit_logs").add({
      action: "teacher_password_reset",
      teacherId: params.teacherId,
      requestId,
      createdAt: resetAt,
      createdBy: decodedToken.uid
    });

    return NextResponse.json({ ok: true, message: "Teacher password reset successfully." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reset password";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
